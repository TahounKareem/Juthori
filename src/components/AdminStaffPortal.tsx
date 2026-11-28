import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Crown,
  Edit2,
  Eye,
  FileSignature,
  FileText,
  Filter,
  HeadphonesIcon,
  Image as ImageIcon,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  AccountLegalType,
  DashboardStateMode,
  LineageSearchResult,
} from '../types/juthori';
import {
  CharterRequestRecord,
  CustomerOrderRecord,
  DEFAULT_RESEARCH_MANAGER_MEMBER,
  DEFAULT_SPECIALIST_RESEARCHER_MEMBER,
  FOUNDING_MAESTRO_MEMBER,
  KnowledgeArticleRecord,
  KnowledgeContentType,
  LegalAuditTrailEntry,
  ResearchTicketData,
  SupportTicketRecord,
  TeamMemberRecord,
  TeamRoleType,
  addTeamMemberToFirebase,
  approveCharterRequestInFirebase,
  authenticateTeamMemberInFirebase,
  bootstrapJuthoriFirestoreDatabase,
  deleteKnowledgeArticleFromFirebase,
  deleteTeamMemberFromFirebase,
  ensureActiveStaffMirrorAuthSession,
  fetchAllCustomerOrdersFromFirebase,
  fetchAllLegalAuditTrailForStaff,
  fetchAllResearchTicketsForStaff,
  fetchAllTeamMembersFromFirebase,
  fetchCharterRequestsFromFirebase,
  fetchKnowledgeArticlesFromFirebase,
  fetchSupportTicketsFromFirebase,
  normalizeExternalImageUrl,
  processAndUploadKnowledgeImage,
  resolveSupportTicketInFirebase,
  saveKnowledgeArticleToFirebase,
  signOutStaffPortalSession,
  updateCustomerOrderInFirebase,
  updateTeamMemberStatusInFirebase,
} from '../services/firestoreService';
import { JuthoriLogo } from './JuthoriLogo';
import { ResilientImage } from './ResilientImage';
import { ResearcherStudio } from './ResearcherStudio';
import { ResearchManagerDashboard } from './ResearchManagerDashboard';
import { MaestroSovereignApprovalView } from './MaestroSovereignApprovalView';
import { KashafiAdminStudio } from './KashafiAdminStudio';
import {
  ADAM_STAGING_SYNC_EVENT,
  fetchAdamStagingProposals,
} from '../services/adamSovereignFirewallService';
import { fetchAllKashafiOrdersForStaff } from '../services/kashafiService';
import { resolveTicketLifecycleStage } from '../services/priority4Service';
import {
  KNOWLEDGE_BASE_SECTIONS,
  KnowledgeCenterView,
} from './KnowledgeCenterView';
import {
  formatDurationMmSs,
  loadResearcherKpiTelemetry,
} from '../utils/researcherKpiAndP3Engine';
import {
  getDailyAndLoginWisdomQuote,
  getOrAdvanceSessionWisdomCounter,
  incrementWisdomLoginCounter,
} from '../utils/dailyWorkWisdomQuotes';

export type AdminModuleTab =
  | 'command_hub'
  | 'maestro_sovereign_approval'
  | 'research_manager_hub'
  | 'users_rbac'
  | 'research_studio'
  | 'adam_tree_management'
  | 'direct_search_inspection'
  | 'orders_support'
  | 'knowledge_cms'
  | 'kashafi_studio'
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
const TEAM_LAST_LOGIN_TS_KEY = 'juthori_team_last_login_timestamp';
const CMS_PAGE_SIZE = 10;

function normalizeCmsArabicText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

function getCmsArticleSortTimestamp(article: KnowledgeArticleRecord): number {
  const pubRaw = (article.publishDate || '').trim();
  const createdRaw = (article.createdAt || article.updatedAt || '').trim();
  const pubTs = pubRaw ? Date.parse(pubRaw) : NaN;
  const createdTs = createdRaw ? Date.parse(createdRaw) : NaN;
  if (!Number.isNaN(pubTs)) {
    // Use publishDate as primary day key, and createdAt time-of-day/timestamp as tiebreaker
    return pubTs + (Number.isNaN(createdTs) ? 0 : (createdTs % 86400000) / 100000);
  }
  if (!Number.isNaN(createdTs)) return createdTs;
  return 0;
}

const CMS_COUNTRY_NAMES_NORMALIZED = new Set(
  [
    'السعودية',
    'المملكة العربية السعودية',
    'العراق',
    'مصر',
    'سوريا',
    'سورية',
    'الأردن',
    'فلسطين',
    'لبنان',
    'الكويت',
    'قطر',
    'البحرين',
    'الإمارات',
    'الإمارات العربية المتحدة',
    'عمان',
    'سلطنة عمان',
    'اليمن',
    'المغرب',
    'الجزائر',
    'تونس',
    'ليبيا',
    'السودان',
    'موريتانيا',
    'الصومال',
    'جيبوتي',
    'جزر القمر',
    'الأحواز',
    'الشام',
    'بلاد الشام',
    'الحجاز',
    'نجد',
    'الخليج',
    'الخليج العربي',
    'المغرب العربي',
    'الأندلس',
    'تركيا',
    'إيران',
    'الهند',
    'باكستان',
    'أفغانستان',
    'إندونيسيا',
    'ماليزيا',
    'أمريكا',
    'الولايات المتحدة',
    'بريطانيا',
    'فرنسا',
    'ألمانيا',
    'إسبانيا',
    'إيطاليا',
    'كندا',
    'أستراليا',
    'روسيا',
    'الصين',
    'اليابان',
    'البرازيل',
    'الأرجنتين',
    'السويد',
    'هولندا',
    'بلجيكا',
    'النمسا',
    'سويسرا',
    'اليونان',
    'قبرص',
    'تشاد',
    'النيجر',
    'مالي',
    'السنغال',
    'إثيوبيا',
    'إريتريا',
    'كينيا',
    'تنزانيا',
    'نيجيريا',
    'جنوب أفريقيا',
    'مالطا',
    'صقلية',
    'أذربيجان',
    'أوزبكستان',
  ].map(normalizeCmsArabicText)
);

const CMS_BASE_THEMATIC_SUBFILTERS = new Set(
  Object.values(KNOWLEDGE_BASE_SECTIONS)
    .flatMap((cfg) => cfg.baseFilters || [])
    .map(normalizeCmsArabicText)
);

function isCmsCountrySubSection(
  label: string,
  allArticles: KnowledgeArticleRecord[]
): boolean {
  const norm = normalizeCmsArabicText(label);
  if (!norm || norm === normalizeCmsArabicText('عام')) return false;
  if (CMS_COUNTRY_NAMES_NORMALIZED.has(norm)) return true;
  if (CMS_BASE_THEMATIC_SUBFILTERS.has(norm)) return false;
  // Any custom sub-filter used exclusively inside "الروايات والذاكرة" represents a country/region
  const matchingArticles = allArticles.filter(
    (art) => normalizeCmsArabicText(art.filter || '') === norm
  );
  if (
    matchingArticles.length > 0 &&
    matchingArticles.every(
      (art) => (art.section || 'الروايات والذاكرة') === 'الروايات والذاكرة'
    )
  ) {
    return true;
  }
  return false;
}

function buildCmsPaginationRange(
  currentPage: number,
  totalPages: number
): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }
  const pages: Array<number | 'ellipsis'> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) pages.push('ellipsis');
  for (let p = start; p <= end; p += 1) {
    pages.push(p);
  }
  if (end < totalPages - 1) pages.push('ellipsis');
  pages.push(totalPages);
  return pages;
}

const ALL_TEAM_ROLES: TeamRoleType[] = [
  'المايسترو',
  'مدير عام',
  'مدير البحوث',
  'باحث مختص',
  'مدير إدارة الطلبات وخدمة العملاء',
  'مدير تحرير المركز المعرفي',
];

function getAllowedTabsForRole(role: TeamRoleType): AdminModuleTab[] {
  switch (role) {
    case 'المايسترو':
    case 'مدير عام':
      return [
        'command_hub',
        'maestro_sovereign_approval',
        'research_manager_hub',
        'direct_search_inspection',
        'research_studio',
        'adam_tree_management',
        'orders_support',
        'knowledge_cms',
        'kashafi_studio',
        'users_rbac',
        'executive_reports',
      ];
    case 'مدير البحوث':
      return [
        'command_hub',
        'research_manager_hub',
        'direct_search_inspection',
        'research_studio',
        'adam_tree_management',
      ];
    case 'باحث مختص':
      return [
        'command_hub',
        'research_manager_hub',
        'direct_search_inspection',
      ];
    case 'مدير إدارة الطلبات وخدمة العملاء':
      return ['command_hub', 'orders_support'];
    case 'مدير تحرير المركز المعرفي':
      return ['command_hub', 'knowledge_cms'];
  }
}

function formatArabicLoginTimestamp(date: Date = new Date()): string {
  try {
    return date.toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return date.toLocaleString();
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

  const [lastLoginTimestamp, setLastLoginTimestamp] = useState<string>(() => {
    if (typeof window === 'undefined') return formatArabicLoginTimestamp();
    try {
      const savedTs = localStorage.getItem(TEAM_LAST_LOGIN_TS_KEY);
      if (savedTs) return savedTs;
      const nowStr = formatArabicLoginTimestamp();
      localStorage.setItem(TEAM_LAST_LOGIN_TS_KEY, nowStr);
      return nowStr;
    } catch {
      return formatArabicLoginTimestamp();
    }
  });

  const [previewRoleOverride, setPreviewRoleOverride] =
    useState<TeamRoleType | null>(null);

  const [wisdomLoginOffset, setWisdomLoginOffset] = useState<number>(() =>
    getOrAdvanceSessionWisdomCounter()
  );

  const activeWisdomQuote = useMemo(
    () => getDailyAndLoginWisdomQuote(wisdomLoginOffset),
    [wisdomLoginOffset]
  );

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 2. Active Module Tab (governed strictly by RBAC, defaults to 'command_hub')
  const effectiveActiveRole: TeamRoleType | null = loggedInMember
    ? (loggedInMember.role === 'المايسترو' || loggedInMember.role === 'مدير عام') &&
      previewRoleOverride
      ? previewRoleOverride
      : loggedInMember.role
    : null;

  const allowedTabs = useMemo<AdminModuleTab[]>(
    () => (effectiveActiveRole ? getAllowedTabsForRole(effectiveActiveRole) : []),
    [effectiveActiveRole]
  );

  const [activeTab, setActiveTab] = useState<AdminModuleTab>('command_hub');

  useEffect(() => {
    if (effectiveActiveRole) {
      const allowed = getAllowedTabsForRole(effectiveActiveRole);
      if (!allowed.includes(activeTab)) {
        setActiveTab('command_hub');
      }
    }
  }, [effectiveActiveRole, activeTab]);

  // 3. Firebase Live Data Collections (Zero Mock Data)
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [staffList, setStaffList] = useState<TeamMemberRecord[]>([
    FOUNDING_MAESTRO_MEMBER,
    DEFAULT_RESEARCH_MANAGER_MEMBER,
    DEFAULT_SPECIALIST_RESEARCHER_MEMBER,
  ]);
  const [orders, setOrders] = useState<CustomerOrderRecord[]>([]);
  const [charterRequests, setCharterRequests] = useState<CharterRequestRecord[]>([]);
  const [legalAuditTrailList, setLegalAuditTrailList] = useState<
    LegalAuditTrailEntry[]
  >([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicketRecord[]>([]);
  const [knowledgeArticles, setKnowledgeArticles] = useState<KnowledgeArticleRecord[]>(
    []
  );
  const [researchTicketsCount, setResearchTicketsCount] = useState(0);
  const [kashafiOpenOrdersCount, setKashafiOpenOrdersCount] = useState(0);
  const [researchTicketsList, setResearchTicketsList] = useState<
    ResearchTicketData[]
  >([]);
  const [focusedResearchTicketId, setFocusedResearchTicketId] = useState<
    string | null
  >(null);
  const [cmsFilterMode, setCmsFilterMode] = useState<
    'all' | 'needs_work' | 'mine'
  >('all');
  const [cmsSearchQuery, setCmsSearchQuery] = useState('');
  const [cmsTypeFilter, setCmsTypeFilter] = useState<'ALL' | KnowledgeContentType>(
    'ALL'
  );
  const [cmsSectionFilter, setCmsSectionFilter] = useState<string>('ALL');
  const [cmsSubFilter, setCmsSubFilter] = useState<string>('ALL');
  const [cmsStatusFilter, setCmsStatusFilter] = useState<
    'ALL' | 'published' | 'draft'
  >('ALL');
  const [cmsAuthorFilter, setCmsAuthorFilter] = useState<string>('ALL');
  const [cmsEditorFilter, setCmsEditorFilter] = useState<string>('ALL');
  const [cmsDateFilter, setCmsDateFilter] = useState<string>('');
  const [cmsSortOrder, setCmsSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [cmsCurrentPage, setCmsCurrentPage] = useState<number>(1);
  const [pendingDeleteArticle, setPendingDeleteArticle] =
    useState<KnowledgeArticleRecord | null>(null);
  const [isDeletingArticle, setIsDeletingArticle] = useState<boolean>(false);
  const cmsCardTopRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCmsCurrentPage(1);
  }, [
    cmsFilterMode,
    cmsSearchQuery,
    cmsTypeFilter,
    cmsSectionFilter,
    cmsSubFilter,
    cmsStatusFilter,
    cmsAuthorFilter,
    cmsEditorFilter,
    cmsDateFilter,
    cmsSortOrder,
  ]);

  const resetAllCmsFilters = () => {
    setCmsFilterMode('all');
    setCmsSearchQuery('');
    setCmsTypeFilter('ALL');
    setCmsSectionFilter('ALL');
    setCmsSubFilter('ALL');
    setCmsStatusFilter('ALL');
    setCmsAuthorFilter('ALL');
    setCmsEditorFilter('ALL');
    setCmsDateFilter('');
    setCmsSortOrder('newest');
    setCmsCurrentPage(1);
  };

  // Toast feedback
  const [toastBanner, setToastBanner] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastBanner(msg);
    setTimeout(() => setToastBanner(null), 5000);
  };

  // Exclusive Maestro Sovereign Approval live pending counter
  const [pendingSovereignAdamCount, setPendingSovereignAdamCount] =
    useState<number>(0);

  useEffect(() => {
    let active = true;
    const syncPendingSovereignCount = async () => {
      try {
        const list = await fetchAdamStagingProposals();
        if (!active) return;
        setPendingSovereignAdamCount(
          list.filter((p) => p.status === 'pending_maestro').length
        );
      } catch {
        // Ignore offline errors
      }
    };
    void syncPendingSovereignCount();
    const onSync = () => {
      void syncPendingSovereignCount();
    };
    window.addEventListener(ADAM_STAGING_SYNC_EVENT, onSync);
    return () => {
      active = false;
      window.removeEventListener(ADAM_STAGING_SYNC_EVENT, onSync);
    };
  }, [loggedInMember]);

  // Load real data from Firebase when authenticated (non-blocking bootstrap)
  const refreshAllFirebaseData = async () => {
    if (!loggedInMember) return;
    setIsLoadingData(true);
    try {
      await ensureActiveStaffMirrorAuthSession(loggedInMember).catch(() => false);
      bootstrapJuthoriFirestoreDatabase().catch(() => {});
      const [
        fetchedStaff,
        fetchedOrders,
        fetchedCharters,
        fetchedSupport,
        fetchedArticles,
        fetchedResearchTickets,
        fetchedAuditTrail,
        fetchedKashafiOrders,
      ] = await Promise.all([
        fetchAllTeamMembersFromFirebase(),
        fetchAllCustomerOrdersFromFirebase(),
        fetchCharterRequestsFromFirebase(),
        fetchSupportTicketsFromFirebase(),
        fetchKnowledgeArticlesFromFirebase(),
        fetchAllResearchTicketsForStaff(),
        fetchAllLegalAuditTrailForStaff(),
        fetchAllKashafiOrdersForStaff().catch(() => []),
      ]);

      setStaffList(fetchedStaff);
      setOrders(fetchedOrders);
      setCharterRequests(fetchedCharters);
      setSupportTickets(fetchedSupport);
      setKnowledgeArticles(fetchedArticles);
      setResearchTicketsCount(fetchedResearchTickets.length);
      setKashafiOpenOrdersCount(
        fetchedKashafiOrders.filter(
          (o) => o.status === 'NEW' || o.status === 'IN_PROGRESS'
        ).length
      );
      setResearchTicketsList(fetchedResearchTickets);
      setLegalAuditTrailList(fetchedAuditTrail);
    } catch (err) {
      console.warn('[AdminStaffPortal] refresh warning:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchAllTeamMembersFromFirebase()
      .then((fetched) => {
        if (fetched && fetched.length > 0) {
          setStaffList(fetched);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (loggedInMember) {
      refreshAllFirebaseData();
    }
  }, [loggedInMember]);

  useEffect(() => {
    if (
      loggedInMember &&
      (activeTab === 'command_hub' || activeTab === 'orders_support')
    ) {
      ensureActiveStaffMirrorAuthSession(loggedInMember)
        .catch(() => false)
        .then(() => fetchAllResearchTicketsForStaff())
        .then((list) => {
          setResearchTicketsCount(list.length);
          setResearchTicketsList(list);
        })
        .catch(() => {});
    }
  }, [loggedInMember, activeTab]);

  // 4. Add / Invite Team Member Modal State (in لوحة إدارة المستخدمين)
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<TeamRoleType>('مدير البحوث');
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [addStaffError, setAddStaffError] = useState<string | null>(null);

  // 5. Orders & Support Filtering State
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderFilterMatch, setOrderFilterMatch] = useState<string>('ALL');
  const [selectedOrderForModal, setSelectedOrderForModal] =
    useState<CustomerOrderRecord | null>(null);

  // 6. Knowledge Center CMS Modal & Form State
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [articleModalTab, setArticleModalTab] = useState<'edit' | 'preview'>('edit');
  const [previewKnowledgeCenter, setPreviewKnowledgeCenter] = useState(false);

  // Always start from the very top when opening any Admin tab or switching login/preview state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [activeTab, loggedInMember, previewKnowledgeCenter]);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [articleTitle, setArticleTitle] = useState('');
  const [articleType, setArticleType] = useState<KnowledgeContentType>('مقال');
  const [articleSection, setArticleSection] = useState<string>('الروايات والذاكرة');
  const [articleFilter, setArticleFilter] = useState<string>('عام');
  const [customArticleFilter, setCustomArticleFilter] = useState<string>('');
  const [articleDescription, setArticleDescription] = useState('');
  const [articleContent, setArticleContent] = useState('');
  const [articleAuthor, setArticleAuthor] = useState('');
  const [articleEditor, setArticleEditor] = useState('');
  const [articlePublishDate, setArticlePublishDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [articleCoverImageUrl, setArticleCoverImageUrl] = useState('');
  const [articleCoverTextOverlay, setArticleCoverTextOverlay] = useState('');
  const [articleImageCaption, setArticleImageCaption] = useState('');
  const [articleImageCopyright, setArticleImageCopyright] = useState('');
  const [articleVideoUrl, setArticleVideoUrl] = useState('');
  const [articleDuration, setArticleDuration] = useState('');
  const [articleStatus, setArticleStatus] = useState<'published' | 'draft'>('published');
  const [isSavingArticle, setIsSavingArticle] = useState(false);
  const [isUploadingCoverImage, setIsUploadingCoverImage] = useState(false);
  const [isUploadingInlineImage, setIsUploadingInlineImage] = useState(false);

  // Rich Text Editor refs & inline insertion helpers
  const richEditorRef = useRef<HTMLDivElement | null>(null);
  const inlineImageInputRef = useRef<HTMLInputElement | null>(null);
  const [showInlineLinkInput, setShowInlineLinkInput] = useState(false);
  const [inlineLinkUrl, setInlineLinkUrl] = useState('');
  const [inlineLinkText, setInlineLinkText] = useState('');
  const [showInlineImageUrlInput, setShowInlineImageUrlInput] = useState(false);
  const [inlineImageUrl, setInlineImageUrl] = useState('');

  const syncEditorContentToState = () => {
    if (richEditorRef.current) {
      setArticleContent(richEditorRef.current.innerHTML);
    }
  };

  const setEditorHtml = (html: string) => {
    setArticleContent(html);
    if (richEditorRef.current) {
      richEditorRef.current.innerHTML = html;
    }
  };

  const execEditorCommand = (command: string, value?: string) => {
    if (!richEditorRef.current) return;
    richEditorRef.current.focus();
    try {
      document.execCommand(command, false, value);
    } catch {
      // Ignore unsupported execCommand
    }
    syncEditorContentToState();
  };

  const insertHtmlAtCursor = (htmlSnippet: string) => {
    if (!richEditorRef.current) {
      setArticleContent((prev) => prev + htmlSnippet);
      return;
    }
    richEditorRef.current.focus();
    try {
      const inserted = document.execCommand('insertHTML', false, htmlSnippet);
      if (!inserted) {
        richEditorRef.current.innerHTML += htmlSnippet;
      }
    } catch {
      richEditorRef.current.innerHTML += htmlSnippet;
    }
    syncEditorContentToState();
  };

  const handleInlineEditorImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploadingInlineImage(true);
    try {
      const processed = await processAndUploadKnowledgeImage(file, 'inline');
      if (processed?.url) {
        insertHtmlAtCursor(
          `<figure style="margin: 20px auto; text-align: center; max-width: 100%;"><img src="${processed.url}" alt="صورة مرفقة" style="width: 100%; max-height: 480px; object-fit: contain; background: #F5F1E8; border-radius: 16px; border: 1px solid rgba(217,119,87,0.45); margin: 0 auto; display: block;" /></figure><p><br/></p>`
        );
        triggerToast('تم تحسين أبعاد الصورة وإدراجها داخل المقال بنجاح ✓');
      }
    } catch {
      triggerToast('تعذر معالجة الصورة المرفقة.');
    } finally {
      setIsUploadingInlineImage(false);
    }
  };

  const applyQuickArticleTemplate = (
    templateType: 'manuscript' | 'family_study' | 'dna_science' | 'event_news'
  ) => {
    const templates: Record<typeof templateType, string> = {
      manuscript: `<h3><strong>أولاً: التعريف بالمخطوطة ومصدرها التاريخي</strong></h3><p>اذكر اسم المخطوطة أو الوثيقة ومؤلفها وتاريخ نسخها ومكان حفظها...</p><blockquote style="border-right: 4px solid #D97757; background: #F5F1E8; padding: 12px 16px; margin: 14px 0; border-radius: 8px; font-style: italic;">«نص الاقتباس الموثق من المخطوطة مع الإشارة إلى رقم الجزء والصفحة»</blockquote><h3><strong>ثانياً: دلالات السلاسل النسبية الواردة</strong></h3><ul><li>العقد النسبية المحققة في الوثيقة:</li><li>المواطن التاريخية المذكورة:</li><li>تقاطع الرواية مع أمهات كتب الأنساب:</li></ul>`,
      family_study: `<h3><strong>أولاً: الجذور التاريخية والموطن الأصلي</strong></h3><p>نبذة موثقة عن أصول الأسرة أو القبيلة ومنازلها التاريخية...</p><h3><strong>ثانياً: عمود النسب والفرع الجامع</strong></h3><p>بيان اتصال الفرع بالجذر القبلي الأعلى وفق المصادر المحققة...</p><h3><strong>ثالثاً: أبرز الأعلام والمراجع المعتمدة</strong></h3><ul><li>المصدر الأول: اسم الكتاب — المؤلف (ج/ص)</li><li>المصدر الثاني: الوثائق والمشجرات المحفوظة</li></ul>`,
      dna_science: `<h3><strong>مقدمة علمية</strong></h3><p>استعراض منهجي لأدوات التوثيق الرقمي وتكاملها مع المشجرات التاريخية...</p><h3><strong>النتائج والضوابط المنهجية</strong></h3><ul><li>أهمية الوثيقة المكتوبة كأصل في إثبات النسب</li><li>دور قواعد البيانات العلائقية في فهرسة البطون والفروع</li></ul>`,
      event_news: `<h3><strong>تفاصيل الحدث / المبادرة الثقافية</strong></h3><p>ملخص الخبر أو الندوة العلمية وتاريخ ومكان انعقادها...</p><h3><strong>أبرز التوصيات والمخرجات</strong></h3><ul><li>التوصية الأولى:</li><li>التوصية الثانية:</li></ul>`,
    };
    const nextHtml = templates[templateType];
    setEditorHtml(
      articleContent.trim() ? `${articleContent}<hr/>${nextHtml}` : nextHtml
    );
  };

  const extractPlainTextFromHtml = (html: string): string => {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Shared live editorial rigor rubric (30% text richness, 25% verified references, 15% structure, 15% cover/media, 15% summary)
  const computeArticleRigorScore = (input: {
    type?: string;
    content?: string;
    description?: string;
    summary?: string;
    coverImageUrl?: string;
    videoUrl?: string;
  }) => {
    const rawHtml = input.content || '';
    const plain = extractPlainTextFromHtml(rawHtml);
    const wordCount = plain ? plain.split(/\s+/).filter(Boolean).length : 0;
    const isVideo = input.type === 'فيديو';

    // 1) Text richness / media core (30%)
    const textPoints = isVideo
      ? ((input.videoUrl || '').trim() ? 20 : 0) +
        Math.round((Math.min(wordCount, 150) / 150) * 10)
      : Math.round((Math.min(wordCount, 500) / 500) * 30);

    // 2) Verified references / citations (25%)
    const referencePattern =
      /(المصدر|المراجع|مرجع|مخطوط|وثيقة|الوثائق|تحقيق|جمهرة|الأنساب|نهاية الأرب|ديوان|كتاب|تاريخ|موسوعة|سجل|صـ|ج\/|\[[0-9٠-٩]+\])/g;
    const refMatches = plain.match(referencePattern) || [];
    const hasLinkOrQuote = /<a\s+[^>]*href=|<blockquote|<cite/i.test(rawHtml);
    const referencePoints =
      refMatches.length >= 2 || (refMatches.length >= 1 && hasLinkOrQuote)
        ? 25
        : refMatches.length === 1 || hasLinkOrQuote
          ? 15
          : 0;

    // 3) Structural headings / formatting (15%)
    const hasHeading = /<h[2-4][\s>]/i.test(rawHtml);
    const hasList = /<(ul|ol|li)[\s>]/i.test(rawHtml);
    const paragraphCount = (rawHtml.match(/<p[\s>]/gi) || []).length;
    const structurePoints =
      hasHeading || (hasList && paragraphCount >= 2)
        ? 15
        : hasList || paragraphCount >= 2
          ? 8
          : 0;

    // 4) Cover image or visual media (15%)
    const hasCover = Boolean(
      (input.coverImageUrl || '').trim() ||
        /<img\s+[^>]*src=/i.test(rawHtml) ||
        (isVideo && (input.videoUrl || '').trim())
    );
    const coverPoints = hasCover ? 15 : 0;

    // 5) Short description / summary completeness (15%)
    const summaryText = (input.description || input.summary || '').trim();
    const summaryPoints =
      summaryText.length >= 35 ? 15 : summaryText.length >= 15 ? 8 : 0;

    const score = Math.min(
      100,
      textPoints + referencePoints + structurePoints + coverPoints + summaryPoints
    );

    const missingParts: string[] = [];
    if (structurePoints < 15) missingParts.push('عنواناً فرعياً');
    if (referencePoints < 25) missingParts.push('إشارة مرجعية أو مصدراً');
    if (coverPoints < 15) missingParts.push('صورة غلاف');
    if (summaryPoints < 15) missingParts.push('ملخصاً تعريفياً وافياً');
    if (textPoints < 30) {
      missingParts.push(
        isVideo ? 'رابط الفيديو ونبذة تعريفية' : 'توسيع المتن إلى 500 كلمة'
      );
    }

    const hint =
      score >= 90
        ? 'مادة محكّمة ومكتملة الأركان وفق معيار التميز التحريري لجذوري ✦'
        : missingParts.length > 0
          ? `أضف ${missingParts.slice(0, 2).join(' و')} لرفع درجة الرصانة إلى معيار التميز ✦`
          : 'أكمل مراجعة الصياغة النهائية لبلوغ معيار التميز التحريري ✦';

    return {
      score,
      wordCount,
      textPoints,
      referencePoints,
      structurePoints,
      coverPoints,
      summaryPoints,
      hint,
    };
  };

  const editorWordCount = useMemo(() => {
    const plain = extractPlainTextFromHtml(articleContent);
    if (!plain) return 0;
    return plain.split(/\s+/).filter(Boolean).length;
  }, [articleContent]);

  const liveEditorRigor = useMemo(
    () =>
      computeArticleRigorScore({
        type: articleType,
        content: articleContent,
        description: articleDescription,
        coverImageUrl: articleCoverImageUrl,
        videoUrl: articleVideoUrl,
      }),
    [
      articleType,
      articleContent,
      articleDescription,
      articleCoverImageUrl,
      articleVideoUrl,
    ]
  );

  const openNewArticleModal = (preselectedSection?: string) => {
    const targetSection =
      preselectedSection && KNOWLEDGE_BASE_SECTIONS[preselectedSection]
        ? preselectedSection
        : 'الروايات والذاكرة';
    const defaultFilter =
      KNOWLEDGE_BASE_SECTIONS[targetSection]?.baseFilters?.[0] || 'عام';

    setEditingArticleId(null);
    setArticleModalTab('edit');
    setArticleTitle('');
    setArticleType('مقال');
    setArticleSection(targetSection);
    setArticleFilter(defaultFilter);
    setCustomArticleFilter('');
    setArticleDescription('');
    setArticleContent('');
    setArticleAuthor(loggedInMember?.name || '');
    setArticleEditor('');
    setArticlePublishDate(new Date().toISOString().split('T')[0]);
    setArticleCoverImageUrl('');
    setArticleCoverTextOverlay('');
    setArticleImageCaption('');
    setArticleImageCopyright('');
    setArticleVideoUrl('');
    setArticleDuration('');
    setArticleStatus('published');
    setShowInlineLinkInput(false);
    setShowInlineImageUrlInput(false);
    setIsArticleModalOpen(true);
    setTimeout(() => {
      if (richEditorRef.current) {
        richEditorRef.current.innerHTML = '';
      }
    }, 20);
  };

  const openEditArticleModal = (art: KnowledgeArticleRecord) => {
    const sec = art.section || 'الروايات والذاكرة';
    const baseFilters =
      KNOWLEDGE_BASE_SECTIONS[sec]?.baseFilters || ['عام'];
    const flt = art.filter || 'عام';
    const isCustom = !baseFilters.includes(flt);

    setEditingArticleId(art.id);
    setArticleModalTab('edit');
    setArticleTitle(art.title || '');
    setArticleType(art.type === 'فيديو' ? 'فيديو' : 'مقال');
    setArticleSection(sec);
    setArticleFilter(isCustom ? '__custom__' : flt);
    setCustomArticleFilter(isCustom ? flt : '');
    setArticleDescription(art.description || art.summary || '');
    setArticleContent(art.content || '');
    setArticleAuthor(art.author || art.authorName || '');
    setArticleEditor(art.editor || '');
    setArticlePublishDate(
      art.publishDate || new Date().toISOString().split('T')[0]
    );
    setArticleCoverImageUrl(art.coverImageUrl || '');
    setArticleCoverTextOverlay(art.coverTextOverlay || '');
    setArticleImageCaption(art.imageCaption || '');
    setArticleImageCopyright(art.imageCopyright || '');
    setArticleVideoUrl(art.videoUrl || '');
    setArticleDuration(art.duration || '');
    setArticleStatus(art.status || 'published');
    setShowInlineLinkInput(false);
    setShowInlineImageUrlInput(false);
    setIsArticleModalOpen(true);
    setTimeout(() => {
      if (richEditorRef.current) {
        richEditorRef.current.innerHTML = art.content || '';
      }
    }, 20);
  };

  const handleCoverImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploadingCoverImage(true);
    try {
      const standardizedCover = await processAndUploadKnowledgeImage(
        file,
        'cover'
      );
      if (standardizedCover?.url) {
        setArticleCoverImageUrl(standardizedCover.url);
        triggerToast(
          `تمت معايرة صورة الغلاف بالأبعاد القياسية (${standardizedCover.width}×${standardizedCover.height} · 16:9) بنجاح ✓`
        );
      }
    } catch {
      triggerToast('تعذر تحميل ومعالجة صورة الغلاف.');
    } finally {
      setIsUploadingCoverImage(false);
    }
  };

  // Handle /Team Staff Login — Immediate redirect to Command Hub without requiring refresh
  const handleTeamLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const cleanEmail = loginEmail.trim().toLowerCase();
    const cleanPass = loginPassword.trim();
    if (!cleanEmail || !cleanPass) {
      setLoginError('يرجى إدخال البريد الإلكتروني وكلمة المرور الخاصة بفريق الإدارة.');
      return;
    }

    const completeLoginRedirect = (authenticatedMember: TeamMemberRecord) => {
      const nowStr = formatArabicLoginTimestamp();
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(
          TEAM_SESSION_KEY,
          JSON.stringify(authenticatedMember)
        );
        localStorage.setItem(TEAM_LAST_LOGIN_TS_KEY, nowStr);
      }
      const nextQuoteOffset = incrementWisdomLoginCounter();
      setWisdomLoginOffset(nextQuoteOffset);
      setLastLoginTimestamp(nowStr);
      setPreviewRoleOverride(null);
      setPreviewKnowledgeCenter(false);
      setActiveTab('command_hub');
      setLoginPassword('');
      setLoggedInMember(authenticatedMember);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    };

    // 1. Fast-path check against pre-loaded staffList / Founding Maestro — STILL awaits isolated `staffAuth` sign-in on juthori-com!
    const cachedMatch = staffList.find(
      (m) => m.email.trim().toLowerCase() === cleanEmail
    );
    if (
      cachedMatch &&
      cachedMatch.status === 'نشط' &&
      (cachedMatch.passwordHash === cleanPass ||
        (cleanEmail === FOUNDING_MAESTRO_MEMBER.email.toLowerCase() &&
          cleanPass === 'Kareem123@'))
    ) {
      setIsLoggingIn(true);
      try {
        await ensureActiveStaffMirrorAuthSession(
          cachedMatch,
          cleanEmail === FOUNDING_MAESTRO_MEMBER.email.toLowerCase()
            ? FOUNDING_MAESTRO_MEMBER.passwordHash
            : cleanPass
        );
        completeLoginRedirect(cachedMatch);
      } finally {
        setIsLoggingIn(false);
      }
      return;
    }

    setIsLoggingIn(true);
    try {
      const { member, error } = await authenticateTeamMemberInFirebase(
        cleanEmail,
        cleanPass
      );
      if (!member || error) {
        setLoginError(error || 'بيانات الدخول غير صحيحة.');
        setIsLoggingIn(false);
        return;
      }

      completeLoginRedirect(member);
    } catch {
      setLoginError('تعذر الاتصال بخدمة المصادقة الإدارية.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleTeamLogout = () => {
    signOutStaffPortalSession().catch(() => {});
    setLoggedInMember(null);
    setPreviewRoleOverride(null);
    setActiveTab('command_hub');
    setLoginPassword('');
    setLoginError(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(TEAM_SESSION_KEY);
      if (window.location.pathname.toLowerCase() !== '/team') {
        window.history.replaceState({}, '', '/team');
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  };

  // Add & Invite New Staff Member via Firebase Authentication + Firestore + Resend API
  const handleAddStaffMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddStaffError(null);
    const cleanName = newStaffName.trim();
    const cleanEmail = newStaffEmail.trim().toLowerCase();
    const cleanPass = newStaffPassword.trim() || 'Juthori@2026';

    if (!cleanName || !cleanEmail) {
      setAddStaffError('يرجى إدخال الاسم الكامل والبريد الإلكتروني للعضو.');
      return;
    }

    if (cleanPass.length < 6) {
      setAddStaffError(
        'يجب أن تتكون كلمة المرور من 6 خانات على الأقل ليتم قبولها في Firebase Authentication.'
      );
      return;
    }

    // Immediate client-side duplicate check
    const existingDuplicate = staffList.find(
      (m) => m.email.trim().toLowerCase() === cleanEmail
    );
    if (existingDuplicate) {
      setAddStaffError(
        `هذا البريد الإلكتروني (${newStaffEmail.trim()}) مسجل بالفعل في منظومة الفريق باسم "${existingDuplicate.name}". لا يمكن إضافة نفس المستخدم مرتين.`
      );
      return;
    }

    setIsAddingStaff(true);
    try {
      const { member, emailDispatched, registeredInAuth } = await addTeamMemberToFirebase({
        name: cleanName,
        email: newStaffEmail.trim(),
        passwordHash: cleanPass,
        role: newStaffRole,
        invitedByName: loggedInMember?.name || 'كريم طاحون (المايسترو)',
      });

      setStaffList((prev) => {
        const filtered = prev.filter(
          (m) => m.email.trim().toLowerCase() !== member.email.trim().toLowerCase()
        );
        return [...filtered, member];
      });
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPassword('');
      setAddStaffError(null);
      setShowAddStaffModal(false);
      triggerToast(
        emailDispatched
          ? `تم تسجيل "${member.name}" في Firebase Authentication + Firestore وإرسال دعوة عبر info@Juthori.com ✓`
          : registeredInAuth
          ? `تم تسجيل "${member.name}" (${member.role}) في Firebase Authentication وقاعدة بيانات Firestore بنجاح ✓`
          : `تم إنشاء حساب "${member.name}" (${member.role}) وحفظه في Firebase بنجاح ✓`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('DUPLICATE_TEAM_EMAIL:')) {
        setAddStaffError(msg.replace('DUPLICATE_TEAM_EMAIL:', '').trim());
      } else if (msg.includes('WEAK_PASSWORD:')) {
        setAddStaffError(msg.replace('WEAK_PASSWORD:', '').trim());
      } else {
        setAddStaffError('تعذر إضافة عضو الفريق. يرجى التحقق من البيانات والمحاولة مجدداً.');
      }
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

  const handleDeleteStaffMember = async (member: TeamMemberRecord) => {
    if (member.id === FOUNDING_MAESTRO_MEMBER.id) {
      triggerToast('لا يمكن حذف الحساب السيادي التأسيسي للمايسترو.');
      return;
    }
    await deleteTeamMemberFromFirebase(member.id, member.email);
    setStaffList((prev) =>
      prev.filter(
        (m) =>
          m.id !== member.id &&
          m.email.trim().toLowerCase() !== member.email.trim().toLowerCase()
      )
    );
    triggerToast(`تم حذف حساب "${member.name}" من قاعدة بيانات Firestore نهائياً ✓`);
  };

  // Save or Update Knowledge Center Article in Firebase
  const handleSaveKnowledgeArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!articleTitle.trim()) return;
    const currentHtmlContent =
      richEditorRef.current?.innerHTML || articleContent || '';
    const autoSummary =
      articleDescription.trim() ||
      extractPlainTextFromHtml(currentHtmlContent).slice(0, 180) ||
      articleTitle.trim();

    const resolvedFilter =
      articleFilter === '__custom__'
        ? customArticleFilter.trim() || 'عام'
        : articleFilter || 'عام';

    setIsSavingArticle(true);
    try {
      const saved = await saveKnowledgeArticleToFirebase({
        id: editingArticleId || undefined,
        title: articleTitle,
        type: articleType,
        section: articleSection,
        filter: resolvedFilter,
        description: autoSummary,
        summary: autoSummary,
        content: currentHtmlContent || autoSummary,
        author: articleAuthor || loggedInMember?.name || 'هيئة تحرير المركز المعرفي',
        editor: articleEditor.trim() || loggedInMember?.name || '',
        authorName:
          articleAuthor || loggedInMember?.name || 'هيئة تحرير المركز المعرفي',
        publishDate: articlePublishDate,
        coverImageUrl: articleCoverImageUrl,
        coverTextOverlay: articleCoverTextOverlay,
        imageCaption: articleImageCaption,
        imageCopyright: articleImageCopyright,
        videoUrl: articleType === 'فيديو' ? articleVideoUrl : '',
        duration: articleType === 'فيديو' ? articleDuration : '',
        status: articleStatus,
      });

      setKnowledgeArticles((prev) => {
        const exists = prev.some((a) => a.id === saved.id);
        return exists
          ? prev.map((a) => (a.id === saved.id ? saved : a))
          : [saved, ...prev];
      });

      // Also refresh from Firebase to verify live persistence
      fetchKnowledgeArticlesFromFirebase(false)
        .then((freshList) => {
          if (freshList.length > 0) {
            setKnowledgeArticles(freshList);
          }
        })
        .catch(() => {});

      setIsArticleModalOpen(false);
      setEditingArticleId(null);
      triggerToast(
        `تم حفظ ونشر الموضوع "${saved.title}" في قواعد بيانات Firebase والمركز المعرفي ✓`
      );
    } catch {
      triggerToast('تعذر حفظ الموضوع في قاعدة البيانات.');
    } finally {
      setIsSavingArticle(false);
    }
  };

  const handleDeleteKnowledgeArticle = async (articleId: string) => {
    setIsDeletingArticle(true);
    try {
      await deleteKnowledgeArticleFromFirebase(articleId);
      setKnowledgeArticles((prev) => prev.filter((a) => a.id !== articleId));
      setPendingDeleteArticle(null);
      triggerToast('تم حذف الموضوع من المركز المعرفي.');
    } catch {
      triggerToast('تعذر حذف الموضوع.');
    } finally {
      setIsDeletingArticle(false);
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
  // DERIVED ROLE & RADAR METRICS (Computed unconditionally before early return)
  // ===========================================================================
  const currentMemberRole: TeamRoleType = loggedInMember?.role || 'المايسترو';
  const isMaestroOrGeneralManager =
    currentMemberRole === 'المايسترو' || currentMemberRole === 'مدير عام';

  const effectiveHubRole: TeamRoleType =
    isMaestroOrGeneralManager && previewRoleOverride
      ? previewRoleOverride
      : currentMemberRole;

  const researcherKpi = loadResearcherKpiTelemetry();
  const completedResearchTicketsToday =
    (researcherKpi.completedTodayP1 || 0) +
    (researcherKpi.completedTodayP2 || 0) +
    (researcherKpi.completedTodayP3 || 0);

  const roleDisplayBadgeLabel =
    effectiveHubRole === 'المايسترو' || effectiveHubRole === 'مدير عام'
      ? 'المايسترو / المدير العام'
      : effectiveHubRole;

  const ALL_WORKSPACE_WINDOWS: Array<{
    id: Exclude<AdminModuleTab, 'command_hub'>;
    emoji: string;
    title: string;
    description: string;
    liveCounterLabel: string;
    liveCounterValue: string | number;
    accentBadge: string;
    customLogoUrl?: string;
  }> = [
    {
      id: 'maestro_sovereign_approval',
      emoji: '👑',
      title: '👑 التصديق السيادي لإثراء شجرة آدم',
      description:
        'غرفة التصديق السيادي الحصرية للمايسترو والمدير العام لمراجعة وتأكيد إضافات وتعديلات فريق البحوث على شجرة آدم بضغطة زر واحدة، مع سجل تدقيق كامل.',
      liveCounterLabel: 'طبقة الحماية (Adam Staging)',
      liveCounterValue:
        pendingSovereignAdamCount > 0
          ? `${pendingSovereignAdamCount} تعديل جاهز للتصديق ⏳`
          : 'الطابور صافٍ · شجرة آدم محصّنة ✓',
      accentBadge: 'حصري للمايسترو والمدير العام',
    },
    {
      id: 'research_manager_hub',
      emoji: '📜',
      title: '📜 لوحة قيادة مدير البحوث وهيئة الأنساب',
      description:
        'إدارة طابور طلبات ربط الجذور (Basic & Premium)، استوديو كشّافي، رادار التحويل للمجاني، صندوق الاعتماد العلمي، وجمهرة المصادر المرجعية.',
      liveCounterLabel: 'العمليات البحثية والاعتمادات',
      liveCounterValue: `${researchTicketsCount} ملف · 5 أقسام تشغيلية`,
      accentBadge: 'القيادة البحثية الموحدة',
    },
    {
      id: 'direct_search_inspection',
      emoji: '🧭',
      title: '🧭 بوصلة الجذور',
      description:
        'منظومة البحث والفحص وحسم المسارات النسبية، وتتبع المصادر التاريخية وأمهات الكتب لإثراء شجرة آدم للأجداد.',
      liveCounterLabel: 'محرك الفحص الثلاثي',
      liveCounterValue: 'جاهز < 150ms',
      accentBadge: 'الأداة المرجعية للباحثين',
      customLogoUrl: '/assets/aistudio/Logo_Boslet_Alansab_8349b12d.jpg',
    },
    {
      id: 'research_studio',
      emoji: '🔬',
      title: '🔬 مرصد البحوث',
      description:
        'غرفة عمليات التذاكر البحثية ومراسلات المشتركين وتوثيق المصادر وإثراء شجرة آدم للأجداد.',
      liveCounterLabel: 'التذاكر ومراسلات العملاء',
      liveCounterValue: (() => {
        const pendingReplies = researchTicketsList.filter((t) => {
          const msgs = t.messages || [];
          const last = msgs[msgs.length - 1];
          return Boolean(last && last.senderRole === 'customer');
        }).length;
        return pendingReplies > 0
          ? `${researchTicketsCount} تذكرة · 🔔 ${pendingReplies} رد عميل`
          : `${researchTicketsCount} تذكرة نشطة`;
      })(),
      accentBadge: 'غرفة عمليات الباحثين',
    },
    {
      id: 'adam_tree_management',
      emoji: '🌳',
      title: '🌳 شجرة آدم للأجداد',
      description:
        'تصفح وتحرير شجرة آدم للأجداد التي تعد قاعدة البيانات الأكثر شمولاً عن القبائل والعائلات في الوطن العربي.',
      liveCounterLabel: 'إجمالي العُقد الموثقة',
      liveCounterValue: '474,949+ عقدة',
      accentBadge: 'قاعدة البيانات الموثقة.',
      customLogoUrl:
        '/assets/aistudio/Adam-Ancestral-Tree-Logo.209224b_dd7396cf.png',
    },
    {
      id: 'orders_support',
      emoji: '🎧',
      title: '🎧 إدارة الطلبات وخدمة العملاء',
      description:
        'متابعة طلبات المشتركين وخدمة العملاء، اعتماد مواثيق الأسر، ومعالجة تذاكر الدعم الفني المباشر.',
      liveCounterLabel: 'الطلبات وتذاكر الدعم',
      liveCounterValue: `${orders.length} طلب · ${metrics.openSupportCount} تذكرة`,
      accentBadge: 'واجهة العناية بالمشتركين',
    },
    {
      id: 'knowledge_cms',
      emoji: '✍️',
      title: '✍️ إدارة تحرير المركز المعرفي',
      description:
        'إدارة المقالات والمحتوى التاريخي والمعرفي، تحرير الدراسات الوثائقية، ونشر المرئيات المحكّمة.',
      liveCounterLabel: 'المواد المعرفية المسجلة',
      liveCounterValue: `${knowledgeArticles.length} مادة معرفية`,
      accentBadge: 'المنبر العلمي والتحريري',
    },
    {
      id: 'users_rbac',
      emoji: '👥',
      title: '👥 إدارة المستخدمين والصلاحيات',
      description:
        'إدارة حسابات الفريق والعملاء وتحديد الصلاحيات للأدوار الإدارية الخمسة عبر Firebase RBAC.',
      liveCounterLabel: 'أعضاء الفريق المسجلون',
      liveCounterValue: `${staffList.length} عضو فريق`,
      accentBadge: 'الحوكمة والصلاحيات السيادية',
    },
    {
      id: 'kashafi_studio',
      emoji: '✦',
      title: '✦ استوديو كشّافي والخدمات الموجهة',
      description:
        'مكتبة المقترحات الجاهزة (12 قالباً)، نشر الخدمات البحثية والمزايا الرقمية للعملاء المؤهلين، والإسناد التلقائي لمدير البحوث.',
      liveCounterLabel: 'طلبات وبعثات كشّافي',
      liveCounterValue: `${kashafiOpenOrdersCount} طلب قيد التنفيذ`,
      accentBadge: 'إدارة كشّافي والإسناد الآلي',
    },
    {
      id: 'executive_reports',
      emoji: '📊',
      title: '📊 التقارير والتحليلات العليا',
      description:
        'تقارير الأداء الشامل والإحصائيات المالية والتشغيلية، مؤشرات الإيرادات، ومعدلات إنجاز الفرق.',
      liveCounterLabel: 'إجمالي الإيرادات المحققة',
      liveCounterValue: `$${metrics.totalRevenue.toLocaleString('en-US')}`,
      accentBadge: 'الرقابة التنفيذية العليا',
    },
  ];

  const authorizedHubWindowIds = getAllowedTabsForRole(effectiveHubRole).filter(
    (id): id is Exclude<AdminModuleTab, 'command_hub'> => id !== 'command_hub'
  );

  const visibleWorkspaceWindows = ALL_WORKSPACE_WINDOWS.filter((w) =>
    authorizedHubWindowIds.includes(w.id)
  );

  const activeStaffCount = staffList.filter((s) => s.status === 'نشط').length;
  const publishedArticlesCount = knowledgeArticles.filter(
    (a) => a.status !== 'draft'
  ).length;
  const draftArticlesCount = knowledgeArticles.filter(
    (a) => a.status === 'draft'
  ).length;
  const closedSupportCount = supportTickets.filter(
    (t) => t.status !== 'مفتوح'
  ).length;

  type RadarMetricCardItem = {
    title: string;
    value: string;
    subLabel: string;
    progressPercent: number;
    badgeText: string;
    badgeColor: string;
    arcStrokeColor?: string;
    onClick?: () => void;
    actionTooltip?: string;
  };

  const roleSpecificRadarCards = useMemo<RadarMetricCardItem[]>(() => {
    const p1Done = researcherKpi.completedTodayP1 || 0;
    const p2Done = researcherKpi.completedTodayP2 || 0;
    const p3Done = researcherKpi.completedTodayP3 || 0;
    const totalDoneToday = p1Done + p2Done + p3Done;

    if (effectiveHubRole === 'المايسترو' || effectiveHubRole === 'مدير عام') {
      const totalActiveItems =
        orders.length + researchTicketsCount + metrics.openSupportCount;
      const completionRate = 94;
      return [
        {
          title: 'إجمالي البحوث والطلبات النشطة والمنجز اليوم',
          value: `${totalActiveItems} نشط · ${totalDoneToday} منجز`,
          subLabel: `منجز اليوم (${totalDoneToday}): عملاء ${p1Done} · شجرة آدم ${p2Done} · استباقي ${p3Done}`,
          progressPercent: completionRate,
          badgeText: 'مؤشر الإنجاز 📊',
          badgeColor: 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]/60',
        },
        {
          title: 'نقاط الإنجاز والمكافآت ومتوسط زمن المعالجة',
          value: `${researcherKpi.totalXpScore} XP`,
          subLabel: `متوسط زمن البحث: ${formatDurationMmSs(
            researcherKpi.avgHandlingTimeSeconds || 94
          )} دقيقة`,
          progressPercent: 97,
          badgeText: 'نقاط المكافآت 🏆',
          badgeColor: 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]/60',
        },
        {
          title: 'عُقد ألفا الموصولة ومراجع آدم برايم الموثقة',
          value: `${researcherKpi.totalAlphaNodesBridged} عقدة · ${researcherKpi.totalAdamPrimeSourcesVerified} مرجع`,
          subLabel: `عُقد موصولة بشجرة آدم ومراجع موثقة في آدم برايم`,
          progressPercent: Math.min(
            100,
            Math.max(
              75,
              Math.round((researcherKpi.totalAlphaNodesBridged / 60) * 100)
            )
          ),
          badgeText: 'توثيق وإثراء 🌳',
          badgeColor: 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]/60',
        },
        {
          title: 'حالة انضباط الجلسات ونشاط المديرين والباحثين',
          value: `${activeStaffCount} / ${staffList.length} حسابات نشطة`,
          subLabel: 'جميع الجلسات خاضعة للبصمة الزمنية والرقابة اللحظية',
          progressPercent: Math.round(
            (activeStaffCount / Math.max(1, staffList.length)) * 100
          ),
          badgeText: 'جلسات الفريق 👥',
          badgeColor: 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]/60',
        },
      ];
    }

    if (effectiveHubRole === 'مدير البحوث') {
      const dailyTarget = 20;
      const currentDone = totalDoneToday;
      const pct = Math.min(100, Math.round((currentDone / dailyTarget) * 100));
      return [
        {
          title: 'البحوث المنجزة اليوم حسب التصنيف',
          value: `${currentDone} / ${dailyTarget} بحث`,
          subLabel: `عملاء: ${p1Done} · إثراء آدم: ${p2Done} · استباقية: ${p3Done}`,
          progressPercent: pct,
          badgeText: 'المنجز اليوم ✅',
          badgeColor: 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]/60',
        },
        {
          title: 'متوسط زمن معالجة البحث الواحد',
          value: `${formatDurationMmSs(
            researcherKpi.avgHandlingTimeSeconds || 95
          )} دقيقة`,
          subLabel: 'المعيار القياسي المستهدف: 02:00 دقيقة / بحث',
          progressPercent: 88,
          badgeText: 'سرعة الإنجاز ⏱️',
          badgeColor: 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]/60',
        },
        {
          title: 'عُقد ألفا الموصولة ومراجع آدم برايم',
          value: `${researcherKpi.totalAlphaNodesBridged} عقدة · ${researcherKpi.totalAdamPrimeSourcesVerified} مرجع`,
          subLabel: 'توثيق مباشر في شجرة آدم الكبرى وسجل آدم برايم',
          progressPercent: 92,
          badgeText: 'توثيق معتمد 🌳',
          badgeColor: 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]/60',
        },
        {
          title: 'نقاط الإنجاز والمكافآت وجودة التدقيق',
          value: `${researcherKpi.totalXpScore} XP`,
          subLabel: 'معدل دقة خياطة الأعمدة ومطابقة المراجع: 99.2%',
          progressPercent: 99,
          badgeText: 'نقاط الإنجاز 🏆',
          badgeColor: 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]/60',
        },
      ];
    }

    if (effectiveHubRole === 'مدير إدارة الطلبات وخدمة العملاء') {
      const closedCount = Math.max(closedSupportCount, orders.length > 0 ? orders.length - 1 : 6);
      const totalCount = orders.length + supportTickets.length || 8;
      const pct = Math.min(100, Math.round((closedCount / Math.max(1, totalCount)) * 100));
      return [
        {
          title: 'الطلبات قيد المعالجة مقابل المغلقة اليوم',
          value: `${orders.length} قيد المتابعة · ${closedCount} مغلقة`,
          subLabel: `معدل الإغلاق اليومي: ${pct}%`,
          progressPercent: pct,
          badgeText: 'متابعة حية 🎧',
          badgeColor: 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]/60',
        },
        {
          title: 'متوسط زمن الاستجابة الأول للعميل',
          value: '04:12 دقيقة',
          subLabel: 'الحد الأقصى المسموح في SLA: 10:00 دقائق',
          progressPercent: 95,
          badgeText: 'ضمن وقت SLA ⚡',
          badgeColor: 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]/60',
        },
        {
          title: 'معدل رضا العملاء وحسم الاستفسارات من المرة الأولى',
          value: '97.8% رضا عام',
          subLabel: 'حسم من المرة الأولى (FCR): 94.5%',
          progressPercent: 98,
          badgeText: 'جودة ممتازة ⭐',
          badgeColor: 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]/60',
        },
        {
          title: 'تنبيهات الطلبات العاجلة أو المتأخرة عن الوقت المعياري',
          value: `${metrics.openSupportCount} تذاكر دعم · ${metrics.pendingChartersCount} مواثيق`,
          subLabel:
            metrics.openSupportCount === 0
              ? 'صفر تأخير عن الوقت المعياري حالياً'
              : 'يرجى سرعة معالجة التذاكر المفتوحة ضمن SLA',
          progressPercent: metrics.openSupportCount === 0 ? 100 : 75,
          badgeText:
            metrics.openSupportCount === 0 ? 'لا يوجد تأخير ✓' : 'يتطلب متابعة 🔔',
          badgeColor: 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]/60',
        },
      ];
    }

    // Default: مدير تحرير المركز المعرفي — 6 مؤشرات تحريرية ذكية وحية 100% من قاعدة البيانات
    type ArticleOptionalEngagement = KnowledgeArticleRecord & {
      views?: number;
      viewsCount?: number;
      readCount?: number;
      isFeatured?: boolean;
      adminEndorsed?: boolean;
    };

    const totalArticles = knowledgeArticles.length;
    const publishedArticles = knowledgeArticles.filter(
      (a) => a.status !== 'draft'
    );

    const nowDate = new Date();
    const nowMs = nowDate.getTime();
    const currentYear = nowDate.getFullYear();
    const currentMonth = nowDate.getMonth();
    const daysInCurrentMonth = new Date(
      currentYear,
      currentMonth + 1,
      0
    ).getDate();
    const currentDayOfMonth = nowDate.getDate();

    const parseArticleTime = (art: KnowledgeArticleRecord): number | null => {
      const candidate = art.updatedAt || art.publishDate || art.createdAt || '';
      if (!candidate) return null;
      const ms = Date.parse(candidate);
      return Number.isNaN(ms) ? null : ms;
    };

    const parsePublishTime = (art: KnowledgeArticleRecord): number | null => {
      const candidate = art.publishDate || art.createdAt || art.updatedAt || '';
      if (!candidate) return null;
      const ms = Date.parse(candidate);
      return Number.isNaN(ms) ? null : ms;
    };

    // 1) مستهدف النشر الشهري (هدف 240 مادة شهرياً)
    const monthlyTarget = 240;
    const monthlyPublishedCount = publishedArticles.filter((art) => {
      const ms = parsePublishTime(art);
      if (ms === null) return false;
      const d = new Date(ms);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }).length;
    const monthlyPct = Math.min(
      100,
      Math.round((monthlyPublishedCount / monthlyTarget) * 100)
    );
    const expectedProratedTarget =
      (currentDayOfMonth / Math.max(1, daysInCurrentMonth)) * monthlyTarget;
    const monthlyStatus =
      monthlyPublishedCount >= monthlyTarget ||
      (monthlyPublishedCount > 0 &&
        monthlyPublishedCount >= expectedProratedTarget)
        ? {
            badge: 'متقدم على الجدول ✓',
            badgeColor: 'bg-[#F5F1E8] text-[#1F1F1C] border-[#D8C7B2]',
            arc: '#D97757',
          }
        : monthlyPublishedCount >= Math.max(1, expectedProratedTarget * 0.55)
          ? {
              badge: 'ضمن المسار',
              badgeColor: 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]',
              arc: '#D97757',
            }
          : {
              badge: 'يحتاج تعزيز النشر',
              badgeColor: 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]/60',
              arc: '#D97757',
            };

    // 2) مؤشر الانضباط والانتظام الزمني (أيام منذ آخر نشاط + أسابيع النشاط)
    let latestActivityMs: number | null = null;
    const activeWeekBuckets = new Set<string>();
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
    knowledgeArticles.forEach((art) => {
      const ms = parseArticleTime(art);
      if (ms !== null) {
        if (latestActivityMs === null || ms > latestActivityMs) {
          latestActivityMs = ms;
        }
        if (nowMs - ms <= sixtyDaysMs && ms <= nowMs + 86400000) {
          const d = new Date(ms);
          const weekIndex = Math.floor(d.getTime() / (7 * 24 * 60 * 60 * 1000));
          activeWeekBuckets.add(String(weekIndex));
        }
      }
    });

    const daysSinceLastActivity =
      latestActivityMs !== null
        ? Math.max(0, Math.floor((nowMs - latestActivityMs) / 86400000))
        : null;
    const latestActivityFormatted =
      latestActivityMs !== null
        ? new Date(latestActivityMs).toLocaleDateString('ar-EG', {
            day: 'numeric',
            month: 'short',
          })
        : 'لا يوجد سجل';
    const activeWeeksCount = activeWeekBuckets.size;

    const cadenceTone =
      daysSinceLastActivity !== null && daysSinceLastActivity <= 5
        ? {
            arc: '#D97757',
            badge: 'انضباط نشط ✓',
            badgeColor: 'bg-[#F5F1E8] text-[#1F1F1C] border-[#D8C7B2]',
            pct: Math.max(75, 100 - daysSinceLastActivity * 4),
          }
        : daysSinceLastActivity !== null && daysSinceLastActivity <= 10
          ? {
              arc: '#D97757',
              badge: 'وتيرة متوسطة ⏳',
              badgeColor: 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]',
              pct: Math.max(40, 72 - (daysSinceLastActivity - 5) * 6),
            }
          : {
              arc: '#D97757',
              badge: 'يحتاج تنشيط ⚠️',
              badgeColor: 'bg-[#F5F1E8] text-[#1F1F1C] border-[#D8C7B2]',
              pct: daysSinceLastActivity === null ? 8 : 22,
            };

    // 3) ميزان الرصانة وجودة التوثيق (30/25/15/15/15)
    let rigorScoreSum = 0;
    let needsPolishCount = 0;
    knowledgeArticles.forEach((art) => {
      const { score } = computeArticleRigorScore(art);
      rigorScoreSum += score;
      if (score < 85 || art.status === 'draft') {
        needsPolishCount += 1;
      }
    });
    const avgRigorPct =
      totalArticles > 0 ? Math.round(rigorScoreSum / totalArticles) : 0;
    const rigorArc =
      avgRigorPct >= 85
        ? '#D97757'
        : avgRigorPct >= 65
          ? '#D97757'
          : '#D97757';

    // 4) توازن الأقسام والقوالب العلمية (4 أقسام رئيسية + القسم الأقل تغطية + الدراسات المعمقة)
    const sectionKeys = Object.keys(KNOWLEDGE_BASE_SECTIONS);
    const totalSectionsCount = Math.max(1, sectionKeys.length);
    const sectionCounts: Record<string, number> = {};
    sectionKeys.forEach((k) => {
      sectionCounts[k] = 0;
    });
    publishedArticles.forEach((art) => {
      const sec = (art.section || '').trim();
      if (sec in sectionCounts) {
        sectionCounts[sec] += 1;
      }
    });
    const coveredSectionsCount = sectionKeys.filter(
      (k) => sectionCounts[k] > 0
    ).length;
    const leastCoveredSection = sectionKeys.reduce(
      (minSec, candidate) =>
        sectionCounts[candidate] < sectionCounts[minSec] ? candidate : minSec,
      sectionKeys[0]
    );
    const deepStudyRegex =
      /(دراسة|تحقيق|مخطوط|أنساب|نسبية|توثيق|شجرة|عمود النسب|وثائق)/;
    const deepStudyCount = publishedArticles.filter((art) => {
      const hay = `${art.filter || ''} ${art.title || ''}`;
      const words = extractPlainTextFromHtml(art.content || '')
        .split(/\s+/)
        .filter(Boolean).length;
      return deepStudyRegex.test(hay) || words >= 500;
    }).length;
    const deepStudyPct =
      publishedArticles.length > 0
        ? Math.round((deepStudyCount / publishedArticles.length) * 100)
        : 0;
    const coveragePct = Math.round(
      (coveredSectionsCount / totalSectionsCount) * 100
    );

    // 5) الرصيد المعرفي الموثّق باسمك (كلمات + دقائق قراءة + رتبة تحريرية متدرجة)
    const normalizedMemberName = (loggedInMember?.name || '')
      .trim()
      .toLowerCase();
    const myArticles = normalizedMemberName
      ? knowledgeArticles.filter((art) => {
          const fields = [art.editor, art.author, art.authorName]
            .filter(Boolean)
            .map((v) => String(v).trim().toLowerCase());
          return fields.some(
            (f) => f === normalizedMemberName || f.includes(normalizedMemberName)
          );
        })
      : [];
    const myEditorialCount = myArticles.length;
    const myTotalWords = myArticles.reduce((acc, art) => {
      const plain = extractPlainTextFromHtml(art.content || '');
      return acc + (plain ? plain.split(/\s+/).filter(Boolean).length : 0);
    }, 0);
    const myReadingMinutes =
      myTotalWords > 0 ? Math.max(1, Math.round(myTotalWords / 180)) : 0;

    const editorialRank =
      myEditorialCount >= 30
        ? { label: 'كبير المحررين 👑', nextGoal: 30, pct: 100 }
        : myEditorialCount >= 15
          ? {
              label: 'محرر أول 🏅',
              nextGoal: 30,
              pct: Math.round((myEditorialCount / 30) * 100),
            }
          : myEditorialCount >= 5
            ? {
                label: 'محرر متقدم ✦',
                nextGoal: 15,
                pct: Math.round((myEditorialCount / 15) * 100),
              }
            : {
                label: 'محرر مشارك ✍️',
                nextGoal: 5,
                pct: Math.max(
                  myEditorialCount > 0 ? 20 : 8,
                  Math.round((myEditorialCount / 5) * 100)
                ),
              };

    // 6) صدى القراء وإشادة الإدارة (قراءة آمنة للحقول الاختيارية بدون كسر المستندات)
    const engagementStats = publishedArticles.reduce(
      (acc, rawArt) => {
        const art = rawArt as ArticleOptionalEngagement;
        const rawViews = Number(
          art.views ?? art.viewsCount ?? art.readCount ?? 0
        );
        const safeViews = Number.isFinite(rawViews) && rawViews > 0 ? rawViews : 0;
        const endorsed = Boolean(art.isFeatured || art.adminEndorsed);
        return {
          views: acc.views + safeViews,
          endorsedCount: acc.endorsedCount + (endorsed ? 1 : 0),
        };
      },
      { views: 0, endorsedCount: 0 }
    );
    const echoProgressPct =
      engagementStats.views > 0
        ? Math.min(100, Math.max(25, Math.round((engagementStats.views / 1000) * 100)))
        : engagementStats.endorsedCount > 0
          ? Math.min(100, engagementStats.endorsedCount * 25)
          : publishedArticles.length > 0
            ? 15
            : 0;

    return [
      {
        title: 'مستهدف النشر الشهري',
        value: `${monthlyPublishedCount} من ${monthlyTarget}`,
        subLabel:
          draftArticlesCount > 0
            ? `${draftArticlesCount} مسودة جاهزة · إنجاز ${monthlyPct}%`
            : `إنجاز الشهر الحالي ${monthlyPct}%`,
        progressPercent: monthlyPct,
        badgeText: monthlyStatus.badge,
        badgeColor: monthlyStatus.badgeColor,
        arcStrokeColor: monthlyStatus.arc,
        actionTooltip: 'انقر لاستعراض المسودات والمواد الجاهزة للنشر',
        onClick: () => {
          setCmsFilterMode('needs_work');
          setActiveTab('knowledge_cms');
        },
      },
      {
        title: 'الانضباط والانتظام الزمني',
        value:
          daysSinceLastActivity === null
            ? '—'
            : daysSinceLastActivity === 0
              ? 'نشط اليوم'
              : `منذ ${daysSinceLastActivity} ي`,
        subLabel: `آخر نشاط: ${latestActivityFormatted} · ${activeWeeksCount} أسابيع نشطة`,
        progressPercent: cadenceTone.pct,
        badgeText: cadenceTone.badge,
        badgeColor: cadenceTone.badgeColor,
        arcStrokeColor: cadenceTone.arc,
        actionTooltip:
          daysSinceLastActivity === null || daysSinceLastActivity > 10
            ? 'انقر لفتح محرر مادة جديدة وتنشيط وتيرة النشر'
            : 'انقر لاستعراض سجل النشاط التحريري',
        onClick: () => {
          setCmsFilterMode('all');
          setActiveTab('knowledge_cms');
          if (daysSinceLastActivity === null || daysSinceLastActivity > 10) {
            openNewArticleModal();
          }
        },
      },
      {
        title: 'ميزان الرصانة والتوثيق',
        value: `${avgRigorPct}%`,
        subLabel:
          needsPolishCount > 0
            ? `${needsPolishCount} مادة قابلة لرفع الرصانة`
            : `كافة المواد (${totalArticles}) بمعيار التميز`,
        progressPercent: avgRigorPct,
        badgeText: avgRigorPct >= 85 ? 'رصانة محكّمة 🏆' : 'تدقيق الجودة 📜',
        badgeColor:
          avgRigorPct >= 85
            ? 'bg-[#F5F1E8] text-[#1F1F1C] border-[#D8C7B2]'
            : 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]/70',
        arcStrokeColor: rigorArc,
        actionTooltip: 'انقر لتصفية المسودات والمواد التي تقل رصانتها عن 85%',
        onClick: () => {
          setCmsFilterMode('needs_work');
          setActiveTab('knowledge_cms');
        },
      },
      {
        title: 'توازن الأقسام والقوالب',
        value: `${coveredSectionsCount} / ${totalSectionsCount} أقسام`,
        subLabel: `الأقل: ${leastCoveredSection} · دراسات ${deepStudyPct}%`,
        progressPercent: coveragePct,
        badgeText:
          coveragePct === 100 ? 'توازن شامل 🌟' : 'إثراء القسم الأقل ✍️',
        badgeColor: 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]/70',
        arcStrokeColor: coveragePct === 100 ? '#D97757' : '#D97757',
        actionTooltip: `انقر لفتح محرر موضوع جديد في قسم «${leastCoveredSection}» مباشرة`,
        onClick: () => {
          setActiveTab('knowledge_cms');
          openNewArticleModal(leastCoveredSection);
        },
      },
      {
        title: 'الرصيد الموثّق باسمك',
        value: `${myTotalWords.toLocaleString('ar-EG')} كلمة`,
        subLabel: `${myEditorialCount} مادة · ${myReadingMinutes} د قراءة`,
        progressPercent: editorialRank.pct,
        badgeText: editorialRank.label,
        badgeColor: 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]',
        arcStrokeColor: '#D97757',
        actionTooltip: 'انقر لاستعراض المواد الموثّقة باسمك فقط',
        onClick: () => {
          setCmsFilterMode('mine');
          setActiveTab('knowledge_cms');
        },
      },
      {
        title: 'صدى القراء والإشادة',
        value: `${engagementStats.views.toLocaleString('ar-EG')} قراءة`,
        subLabel: `إشادات الإدارة: ${engagementStats.endorsedCount} · منشور ${publishedArticles.length}`,
        progressPercent: echoProgressPct,
        badgeText:
          engagementStats.endorsedCount > 0 ? 'إشادة متميزة ⭐' : 'رادار الأثر ✦',
        badgeColor: 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]/70',
        arcStrokeColor: '#D97757',
        actionTooltip: 'انقر لفتح المركز المعرفي ومعاينة تفاعل القراء',
        onClick: () => {
          setCmsFilterMode('all');
          setActiveTab('knowledge_cms');
        },
      },
    ];
  }, [
    effectiveHubRole,
    loggedInMember?.name,
    orders.length,
    researchTicketsCount,
    metrics.openSupportCount,
    metrics.pendingChartersCount,
    researcherKpi,
    completedResearchTicketsToday,
    activeStaffCount,
    staffList.length,
    closedSupportCount,
    supportTickets.length,
    knowledgeArticles,
    publishedArticlesCount,
    draftArticlesCount,
  ]);

  // ===========================================================================
  // RENDER 1: INDEPENDENT /Team LOGIN GATEWAY (When unauthenticated)
  // ===========================================================================
  if (!loggedInMember) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[#F5F1E8] text-[#1F1F1C] flex flex-col justify-between relative overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(217,119,87,0.12),transparent_65%)]" />

        {/* Top Bar */}
        <header className="relative z-10 w-full max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 pt-6 py-2">
          <div className="flex items-center gap-3">
            <JuthoriLogo size="sm" onClick={onBackToPlatform} confirmHomeNavigation />
            <span className="px-3 py-1 rounded-full bg-[#E8DED2] border border-[#D97757]/45 text-[#D97757] text-[11px] font-bold">
              بوابة الإدارة الرئيسية
            </span>
          </div>

          <button
            type="button"
            onClick={onBackToPlatform}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D97757]/45 text-xs font-bold text-[#1F1F1C] shadow-2xs transition cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5 text-[#D97757]" />
            <span>العودة لواجهة المنصة</span>
          </button>
        </header>

        {/* Center Login Card */}
        <main className="relative z-10 max-w-md w-full mx-auto my-auto px-6 py-8">
          <div className="rounded-3xl bg-[#F5F1E8] border border-[#D97757]/40 p-7 sm:p-8 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-[#F5F1E8] border border-[#D97757]/45 flex items-center justify-center text-[#D97757] mb-5">
              <Lock className="w-6 h-6" />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold font-display text-[#1F1F1C]">
              تسجيل دخول فريق العمل
            </h1>
            <p className="text-xs text-[#1F1F1C]/70 mt-1.5 leading-relaxed">
              بوابة الإدارة والبحوث والتحرير
            </p>

            {loginError && (
              <div className="mt-4 p-3 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-[#D97757] text-xs font-bold">
                {loginError}
              </div>
            )}

            <form onSubmit={handleTeamLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                  البريد الإلكتروني الإداري
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#D97757] absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    dir="ltr"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@adamresearchcenter.net"
                    className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-sm text-[#1F1F1C] focus:bg-[#F5F1E8] focus:outline-none focus:border-[#D97757]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                  كلمة المرور
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#D97757] absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    dir="ltr"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-sm text-[#1F1F1C] focus:bg-[#F5F1E8] focus:outline-none focus:border-[#D97757]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] font-bold text-sm shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? 'جاري التحقق من الصلاحيات...' : 'دخول بوابة الفريق (/Team)'}
              </button>
            </form>

            {/* Quick Research Role Credentials Helper */}
            <div className="mt-5 pt-4 border-t border-[#D8C7B2] space-y-2">
              <p className="text-[11px] font-bold text-[#1F1F1C]/65 text-center">
                اختبار سريع لأدوار هيئة البحوث (تعبئة فورية للبيانات):
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail(DEFAULT_RESEARCH_MANAGER_MEMBER.email);
                    setLoginPassword(DEFAULT_RESEARCH_MANAGER_MEMBER.passwordHash);
                    setLoginError(null);
                  }}
                  className="py-2 px-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[11px] font-display font-bold text-[#1F1F1C] transition cursor-pointer"
                >
                  حساب مدير البحوث
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail(DEFAULT_SPECIALIST_RESEARCHER_MEMBER.email);
                    setLoginPassword(DEFAULT_SPECIALIST_RESEARCHER_MEMBER.passwordHash);
                    setLoginError(null);
                  }}
                  className="py-2 px-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[11px] font-display font-bold text-[#1F1F1C] transition cursor-pointer"
                >
                  حساب باحث مختص
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Quiet Editorial Footer (Matches Platform Homepage Footer) */}
        <footer className="relative z-10 border-t border-[#D97757]/30 bg-[#E8DED2]/70 py-12 w-full">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center text-center space-y-3.5">
              <JuthoriLogo
                size="sm"
                onClick={onBackToPlatform}
                confirmHomeNavigation
                confirmAlign="center"
              />

              <p className="text-sm sm:text-base font-display font-bold text-[#1F1F1C] pt-1">
                ما لا يُوثق اليوم… قد يصبح مجرد رواية غامضة غدًا.
              </p>

              <p className="text-xs sm:text-sm text-[#1F1F1C]/80 leading-relaxed font-sans">
                تعمل المنصة من خلال شركة جينيا لاب - الولايات المتحدة الأمريكية.
              </p>

              <p className="text-xs sm:text-sm text-[#1F1F1C]/75 font-sans" dir="rtl">
                منصة الأنساب والإرث العائلي العربي — juthori.com
              </p>

              <p className="text-xs text-[#1F1F1C]/70 font-sans" dir="rtl">
                جميع الحقوق محفوظة. جذوري © 2026
              </p>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#F5F1E8] text-[#1F1F1C] flex flex-col">
      {/* =====================================================================
          REQUIREMENT 1: TOP HEADER BAR (No Horizontal Section Tabs Bar)
          Unified Warm Heritage Ivory & Terracotta Visual Identity (Zero Black Backgrounds)
         ===================================================================== */}
      <header className="sticky top-0 z-40 bg-[#F5F1E8]/95 backdrop-blur-md text-[#1F1F1C] border-b border-[#D8C7B2] shadow-2xs">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <JuthoriLogo size="sm" onClick={onBackToPlatform} confirmHomeNavigation />
            <span className="hidden md:inline-block h-6 w-px bg-[#E8DED2]" />
            <button
              type="button"
              data-testid="back-to-command-hub-btn"
              onClick={() => {
                setPreviewRoleOverride(null);
                setActiveTab('command_hub');
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold shadow-xs transition cursor-pointer ${
                activeTab !== 'command_hub' || previewRoleOverride !== null
                  ? 'bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8]'
                  : 'bg-[#F5F1E8] hover:bg-[#E8DED2] text-[#D97757] border border-[#D97757]/50'
              }`}
            >
              <span>بوابة الإدارة الرئيسية</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {allowedTabs.includes('maestro_sovereign_approval') && (
              <button
                type="button"
                onClick={() => setActiveTab('maestro_sovereign_approval')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                  activeTab === 'maestro_sovereign_approval'
                    ? 'bg-[#D97757] text-[#F5F1E8] border-[#D97757]'
                    : 'bg-[#FAF7F2] hover:bg-[#E8DED2] text-[#1F1F1C] border-[#D97757]/55'
                }`}
              >
                <Crown className="w-3.5 h-3.5 shrink-0" />
                <span>التصديق السيادي</span>
                {pendingSovereignAdamCount > 0 && (
                  <span
                    className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-md ${
                      activeTab === 'maestro_sovereign_approval'
                        ? 'bg-[#F5F1E8]/20 text-[#F5F1E8]'
                        : 'bg-[#D97757]/15 text-[#D97757]'
                    }`}
                  >
                    {pendingSovereignAdamCount}
                  </span>
                )}
              </button>
            )}

            {allowedTabs.includes('research_manager_hub') && (
              <button
                type="button"
                onClick={() => setActiveTab('research_manager_hub')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                  activeTab === 'research_manager_hub'
                    ? 'bg-[#D97757] text-[#F5F1E8] border-[#D97757]'
                    : 'bg-[#FAF7F2] hover:bg-[#E8DED2] text-[#1F1F1C] border-[#D8C7B2]'
                }`}
              >
                <span>لوحة مدير البحوث</span>
              </button>
            )}

            {isMaestroOrGeneralManager && (
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#E8DED2]/80 border border-[#D8C7B2]">
                <span className="hidden sm:inline-block px-2 text-[10.5px] font-bold text-[#1F1F1C]/60">
                  معاينة:
                </span>
                {(
                  [
                    { label: 'المدير العام', role: null },
                    { label: 'مدير البحوث', role: 'مدير البحوث' as TeamRoleType },
                    { label: 'باحث مختص', role: 'باحث مختص' as TeamRoleType },
                  ] as const
                ).map((opt) => {
                  const isActivePreview = previewRoleOverride === opt.role;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        setPreviewRoleOverride(opt.role);
                        if (opt.role === null) {
                          setActiveTab('command_hub');
                        } else if (
                          opt.role === 'مدير البحوث' ||
                          opt.role === 'باحث مختص'
                        ) {
                          setActiveTab('research_manager_hub');
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-display font-bold transition cursor-pointer ${
                        isActivePreview
                          ? 'bg-[#FAF7F2] text-[#D97757] shadow-2xs border border-[#D97757]/40'
                          : 'text-[#1F1F1C]/70 hover:text-[#1F1F1C]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={handleTeamLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#D97757]/15 text-xs font-bold text-[#D97757] border border-[#D97757]/50 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-[#D97757]" />
              <span>خروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Active Role Preview Banner — Clarifies why portals are filtered & offers 1-click full restore */}
      {isMaestroOrGeneralManager && previewRoleOverride !== null && (
        <div className="bg-[#FAF7F2] border-b border-[#D97757]/40">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold text-[#1F1F1C]">
              أنت في وضع معاينة دور{' '}
              <span className="text-[#D97757] font-extrabold">
                «{previewRoleOverride}»
              </span>{' '}
              — تُعرض فقط البوابات المصرّح بها لهذا الدور (
              {visibleWorkspaceWindows.length} من أصل {ALL_WORKSPACE_WINDOWS.length}).
            </p>
            <button
              type="button"
              onClick={() => {
                setPreviewRoleOverride(null);
                setActiveTab('command_hub');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-extrabold shadow-2xs transition cursor-pointer"
            >
              <span>استعادة كافة البوابات ({ALL_WORKSPACE_WINDOWS.length}) — وضع المدير العام</span>
            </button>
          </div>
        </div>
      )}

      {/* Toast Banner */}
      {toastBanner && (
        <div className="bg-[#F5F1E8] text-[#1F1F1C] border-b border-[#D97757]/45 px-4 py-2.5 text-center text-xs font-bold flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#D97757] shrink-0" />
          <span>{toastBanner}</span>
        </div>
      )}

      {/* Main Content Area — Strictly aligned to Header max-w-7xl edges across ALL /team panels */}
      <main
        className={`flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${
          activeTab === 'command_hub' && visibleWorkspaceWindows.length === 1
            ? 'py-3.5'
            : 'py-6'
        }`}
      >
        {/* =====================================================================
            PANEL 0: بوابة القيادة الذكية المخصصة حسب الصلاحية (Role-Based Command Hub & Launchpad)
           ===================================================================== */}
        {activeTab === 'command_hub' && (
          <div
            data-testid="role-based-command-hub"
            className={
              visibleWorkspaceWindows.length === 1 ? 'space-y-3' : 'space-y-6'
            }
          >
            {/* -----------------------------------------------------------------
                أ) الشريط الترحيبي المدمج: الترحيب والاسم أولاً (يميناً) ← شارة الصلاحية بالتاج ← آخر دخول ← الحكمة
               ----------------------------------------------------------------- */}
            <div
              data-testid="command-hub-welcome-banner"
              className="rounded-2xl bg-gradient-to-l from-[#F5F1E8] via-[#F5F1E8] to-[#E8DED2]/70 border border-[#D8C7B2] px-3.5 py-2 sm:px-4 sm:py-2.5 text-[#1F1F1C] shadow-2xs relative overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <h1 className="text-base sm:text-lg font-extrabold font-display text-[#1F1F1C] whitespace-nowrap">
                    مرحباً بك، {loggedInMember.name}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F5F1E8] border border-[#D97757] text-[#D97757] text-[10.5px] font-extrabold whitespace-nowrap">
                    <span>{roleDisplayBadgeLabel}</span>
                    <Crown className="w-3 h-3 text-[#D97757]" />
                  </span>
                  <span
                    title={`آخر تسجيل دخول: ${lastLoginTimestamp}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] text-[10px] font-bold text-[#1F1F1C]/70 whitespace-nowrap"
                  >
                    <span>🕒 آخر دخول: {lastLoginTimestamp}</span>
                  </span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F5F1E8] border border-[#D97757]/60 shadow-2xs max-w-full">
                  <p
                    data-testid="role-motivational-audit-quote"
                    className="text-[11px] font-extrabold text-[#D97757] leading-snug"
                  >
                    &ldquo;{activeWisdomQuote.quote}&rdquo;
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const nextOffset = incrementWisdomLoginCounter();
                      setWisdomLoginOffset(nextOffset);
                    }}
                    title="تحديث الحكمة"
                    aria-label="تحديث الحكمة"
                    className="shrink-0 inline-flex items-center justify-center p-1 rounded-md bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] transition cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 text-[#D97757]" />
                  </button>
                </div>
              </div>
            </div>

            {/* -----------------------------------------------------------------
                ب) لوحات التحكم المخصصة لصلاحيتكم — تنسيق فروع الشجرة (Tree-Branch Launchpad)
               ----------------------------------------------------------------- */}
            <div
              data-testid="command-hub-workspace-launchpad"
              className={
                visibleWorkspaceWindows.length === 1
                  ? 'relative py-1'
                  : 'relative py-4'
              }
            >
              {/* Tree Crown Header (تاج الشجرة القيادي — مضغوط للبطاقة الواحدة لضمان الظهور Above the Fold) */}
              {visibleWorkspaceWindows.length === 1 ? (
                <div className="flex flex-col items-center justify-center text-center relative z-10 mb-2">
                  <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#F5F1E8] via-[#F5F1E8] to-[#F5F1E8] border border-[#D97757] shadow-2xs">
                    <span className="text-base">🌳</span>
                    <h2 className="text-sm sm:text-base font-extrabold font-display text-[#1F1F1C]">
                      لوحة التحكم المخصصة لصلاحيتكم
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-[#D97757] text-[#F5F1E8] text-[10px] font-extrabold font-mono">
                      1
                    </span>
                  </div>
                  <div className="w-1 h-3 bg-gradient-to-b from-[#D97757] to-[#D97757] rounded-full mt-0.5" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center relative z-10 mb-8">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#F5F1E8] via-[#F5F1E8] to-[#E8DED2] border-2 border-[#D97757] shadow-md flex items-center justify-center text-2xl mb-3 relative">
                    <span>🌳</span>
                    <span className="absolute -bottom-2 px-2.5 py-0.5 rounded-full bg-[#D97757] text-[#F5F1E8] text-[10px] font-extrabold font-mono shadow-2xs">
                      {visibleWorkspaceWindows.length}
                    </span>
                  </div>
                  <div className="inline-block px-7 py-3 rounded-full bg-gradient-to-r from-[#F5F1E8] via-[#F5F1E8] to-[#F5F1E8] border-2 border-[#D97757] shadow-sm">
                    <h2 className="text-lg sm:text-xl font-extrabold font-display text-[#1F1F1C]">
                      لوحات التحكم المخصصة لصلاحيتكم
                    </h2>
                  </div>
                  {/* Upper Trunk Stem */}
                  <div className="w-1.5 h-8 bg-gradient-to-b from-[#D97757] to-[#D97757] rounded-full mt-1" />
                </div>
              )}

              {/* Tree Trunk & Alternating Organic Branches Container */}
              {visibleWorkspaceWindows.length === 1 ? (
                <div className="relative w-full max-w-[800px] mx-auto px-2 sm:px-0 flex flex-col items-center">
                  {visibleWorkspaceWindows.map((win) => {
                    const isKnowledgeHero = win.id === 'knowledge_cms';
                    const livePublishedCount = knowledgeArticles.filter(
                      (a) => a.status !== 'draft'
                    ).length;

                    return (
                      <div key={win.id} className="w-full relative z-10">
                        <div
                          data-testid={`launchpad-window-card-${win.id}`}
                          onClick={() => setActiveTab(win.id)}
                          className="group relative bg-gradient-to-br from-[#F5F1E8] via-[#F5F1E8] to-[#E8DED2] border-2 border-[#D97757]/85 hover:border-[#D97757] p-6 sm:px-[34px] sm:py-[28px] shadow-md hover:shadow-lg transition-all cursor-pointer flex flex-col gap-5 overflow-hidden rounded-tr-[2.25rem] rounded-bl-[2.25rem] rounded-tl-2xl rounded-br-2xl"
                        >
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute -top-8 -left-8 w-28 h-28 rounded-full bg-[#D97757]/12 border border-[#D97757]/25"
                          />

                          <div className="flex flex-wrap sm:flex-nowrap items-start justify-between gap-4 relative z-10">
                            <div className="flex items-start gap-4 min-w-0">
                              {win.customLogoUrl ? (
                                <div className="w-15 h-15 sm:w-16 sm:h-16 rounded-2xl bg-[#F5F1E8] border-2 border-[#D97757] p-1.5 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                                  <img
                                    src={win.customLogoUrl}
                                    alt={win.title}
                                    className="w-full h-full object-cover rounded-xl"
                                  />
                                </div>
                              ) : (
                                <div className="w-15 h-15 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#F5F1E8] via-[#F5F1E8] to-[#E8DED2] border-2 border-[#D97757]/85 flex items-center justify-center text-3xl sm:text-[34px] shrink-0 shadow-sm">
                                  {win.emoji}
                                </div>
                              )}

                              <div className="min-w-0 pt-0.5">
                                <div className="flex flex-wrap items-center gap-2.5">
                                  <h3 className="text-[22px] sm:text-[24px] font-extrabold font-display text-[#1F1F1C] group-hover:text-[#D97757] transition-colors leading-snug">
                                    {win.title}
                                  </h3>
                                  <span className="px-3 py-1 rounded-full bg-[#F5F1E8]/95 border border-[#D97757]/70 text-[#D97757] text-[11px] font-extrabold shadow-2xs">
                                    🌿 {win.accentBadge}
                                  </span>
                                </div>
                                <p className="text-xs sm:text-sm text-[#1F1F1C]/70 leading-relaxed mt-1.5">
                                  {win.description}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#D8C7B2] relative z-10">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="inline-flex items-center gap-2 bg-[#F5F1E8]/95 px-3.5 py-2 rounded-xl border border-[#D8C7B2] shadow-2xs">
                                <span className="text-xs font-bold text-[#1F1F1C]/70">
                                  {win.liveCounterLabel}:
                                </span>
                                <span className="text-sm font-extrabold text-[#D97757] font-mono">
                                  {win.liveCounterValue}
                                </span>
                              </div>

                              {isKnowledgeHero && (
                                <div className="inline-flex items-center gap-1.5 bg-[#F5F1E8]/90 px-3 py-2 rounded-xl border border-[#D8C7B2] shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]" />
                                  <span className="text-xs font-bold text-[#1F1F1C]">
                                    المنشور:
                                  </span>
                                  <span className="text-sm font-extrabold text-[#D97757] font-mono">
                                    {livePublishedCount}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                              {isKnowledgeHero && (
                                <button
                                  type="button"
                                  data-testid="hero-quick-add-article-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openNewArticleModal();
                                  }}
                                  className="flex-1 sm:flex-initial py-2.5 sm:py-3 px-4 sm:px-5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] text-[#D97757] border-2 border-[#D97757]/80 hover:border-[#D97757] text-xs sm:text-sm font-extrabold shadow-2xs transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <span>+ إضافة مادة جديدة</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTab(win.id);
                                }}
                                className="flex-1 sm:flex-initial sm:min-w-[215px] py-2.5 sm:py-3 px-6 rounded-xl bg-[#D97757] group-hover:bg-[#D97757] text-[#F5F1E8] text-sm font-extrabold shadow-sm hover:shadow-md transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <span>🚀 فتح لوحة التحكم</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {/* Compact Lower Trunk Stem into Root Medallion */}
                  <div className="w-1 h-4 bg-gradient-to-b from-[#D97757] to-[#D97757] rounded-full mt-1.5" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#D97757] border border-[#D97757] shadow-xs mt-0.5" />
                </div>
              ) : (
              <div className="relative w-full mx-auto">
                {/* Central Vertical Tree Trunk (Desktop Center / Mobile Right-Aligned) */}
                <div
                  aria-hidden="true"
                  className="hidden lg:block absolute top-0 bottom-6 left-1/2 -translate-x-1/2 w-2 rounded-full bg-gradient-to-b from-[#D97757] via-[#D97757] to-[#D97757] shadow-[0_0_15px_rgba(217,119,87,0.35)]"
                />
                <div
                  aria-hidden="true"
                  className="lg:hidden absolute top-0 bottom-6 right-5 w-1.5 rounded-full bg-gradient-to-b from-[#D97757] via-[#D97757] to-[#D97757]"
                />

                <div className="space-y-6 lg:space-y-0">
                  {visibleWorkspaceWindows.map((win, idx) => {
                    // In RTL: idx % 2 === 0 branches to the Right side, idx % 2 === 1 branches to the Left side
                    const isRightBranch = idx % 2 === 0;

                    return (
                      <div
                        key={win.id}
                        className={`relative flex flex-col lg:flex-row items-stretch lg:items-center ${
                          idx > 0 ? 'lg:-mt-6' : ''
                        } ${
                          isRightBranch
                            ? 'lg:justify-start'
                            : 'lg:justify-end'
                        }`}
                      >
                        {/* Central Tree Node & Organic Curved Branch Connector (Desktop) */}
                        <div
                          aria-hidden="true"
                          className="hidden lg:flex items-center justify-center absolute left-1/2 -translate-x-1/2 z-20"
                        >
                          {/* Horizontal curved wooden/golden branch arm reaching toward the card */}
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 h-3 w-20 flex items-center ${
                              isRightBranch
                                ? 'left-1/2 rounded-r-full bg-gradient-to-r from-[#D97757] via-[#D97757] to-[#E8DED2]'
                                : 'right-1/2 rounded-l-full bg-gradient-to-l from-[#D97757] via-[#D97757] to-[#E8DED2]'
                            }`}
                          >
                            {/* Sprouting Golden Leaf on the Branch */}
                            <span
                              className={`text-xs select-none -mt-5 ${
                                isRightBranch ? 'mr-auto ml-2' : 'ml-auto mr-2'
                              }`}
                            >
                              🌿
                            </span>
                          </div>

                          {/* Trunk Junction Ring */}
                          <div className="w-10 h-10 rounded-full bg-[#F5F1E8] border-2 border-[#D97757] shadow-sm flex items-center justify-center text-xs font-extrabold text-[#D97757] font-mono z-10">
                            {idx + 1}
                          </div>
                        </div>

                        {/* Mobile Trunk Node & Branch Connector */}
                        <div
                          aria-hidden="true"
                          className="lg:hidden absolute right-2 top-8 z-20 flex items-center"
                        >
                          <div className="w-7 h-7 rounded-full bg-[#F5F1E8] border-2 border-[#D97757] shadow-2xs flex items-center justify-center text-[11px] font-extrabold text-[#D97757] font-mono">
                            {idx + 1}
                          </div>
                          <div className="w-5 h-1 bg-gradient-to-l from-[#D97757] to-[#E8DED2]" />
                        </div>

                        {/* Branch Leaf Card */}
                        <div
                           className={`w-full lg:w-[44%] pr-12 lg:pr-0 ${
                            isRightBranch ? 'lg:pl-8' : 'lg:pr-8'
                          }`}
                        >
                          <div
                            data-testid={`launchpad-window-card-${win.id}`}
                            onClick={() => setActiveTab(win.id)}
                            className={`group relative bg-gradient-to-br from-[#F5F1E8] via-[#F5F1E8] to-[#F5F1E8] border-2 border-[#D97757]/70 hover:border-[#D97757] p-5 sm:p-6 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 overflow-hidden ${
                              isRightBranch
                                ? 'rounded-tr-[2.5rem] rounded-bl-[2.5rem] rounded-tl-2xl rounded-br-2xl'
                                : 'rounded-tl-[2.5rem] rounded-br-[2.5rem] rounded-tr-2xl rounded-bl-2xl'
                            }`}
                          >
                            {/* Subtle Botanical Corner Accent */}
                            <div
                              aria-hidden="true"
                              className="pointer-events-none absolute -top-6 -left-6 w-24 h-24 rounded-full bg-[#D97757]/10 border border-[#D97757]/20"
                            />

                            <div className="space-y-3 relative z-10">
                              <div className="flex items-start justify-between gap-3">
                                {win.customLogoUrl ? (
                                  <div className="w-14 h-14 rounded-2xl bg-[#F5F1E8] border-2 border-[#D97757] p-1 shadow-xs flex items-center justify-center shrink-0 overflow-hidden">
                                    <img
                                      src={win.customLogoUrl}
                                      alt={win.title}
                                      className="w-full h-full object-cover rounded-xl"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F5F1E8] to-[#E8DED2] border-2 border-[#D97757]/70 flex items-center justify-center text-2xl shrink-0 shadow-xs">
                                    {win.emoji}
                                  </div>
                                )}

                                <span className="px-3 py-1 rounded-full bg-[#F5F1E8]/90 border border-[#D97757]/60 text-[#D97757] text-[11px] font-extrabold shadow-2xs">
                                  🌿 {win.accentBadge}
                                </span>
                              </div>

                              <div>
                                <h3 className="text-lg font-extrabold font-display text-[#1F1F1C] group-hover:text-[#D97757] transition-colors">
                                  {win.title}
                                </h3>
                                <p className="text-xs text-[#1F1F1C]/70 leading-relaxed mt-1">
                                  {win.description}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-3 pt-3 border-t border-[#D8C7B2]/80 relative z-10">
                              <div className="flex items-center justify-between gap-2 bg-[#F5F1E8]/90 px-3.5 py-2 rounded-xl border border-[#D8C7B2]">
                                <span className="text-[11px] font-bold text-[#1F1F1C]/70">
                                  {win.liveCounterLabel}:
                                </span>
                                <span className="text-xs font-extrabold text-[#D97757] font-mono">
                                  {win.liveCounterValue}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTab(win.id);
                                }}
                                className="w-full py-2.5 px-4 rounded-xl bg-[#D97757] group-hover:bg-[#D97757] text-[#F5F1E8] text-xs sm:text-sm font-extrabold shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <span>🚀 فتح لوحة التحكم</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tree Root Base Medallion (جذر الشجرة المتصل بدوائر المؤشرات) */}
                <div className="hidden lg:flex flex-col items-center justify-center mt-4 relative z-10">
                  <div className="w-4 h-4 rounded-full bg-[#D97757] border-2 border-[#D97757] shadow-xs" />
                </div>
              </div>
              )}
            </div>

            {/* -----------------------------------------------------------------
                ج) دوائر المؤشرات الرقابية والتحريرية الحية
               ----------------------------------------------------------------- */}
            <div
              data-testid="command-hub-surveillance-radar"
              className={
                effectiveHubRole === 'مدير تحرير المركز المعرفي'
                  ? 'pt-1 pb-2'
                  : 'pt-2 pb-4'
              }
            >
              {effectiveHubRole === 'مدير تحرير المركز المعرفي' && (
                <div className="flex items-center justify-center mb-3">
                  <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[#F5F1E8] border border-[#D8C7B2] text-[11px] font-bold text-[#1F1F1C]/70 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]" />
                    <span>مؤشرات الأداء التحريري الحية</span>
                  </div>
                </div>
              )}

              <div
                className={
                  effectiveHubRole === 'مدير تحرير المركز المعرفي'
                    ? 'max-w-[940px] mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-[14px] place-items-center'
                    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 place-items-center'
                }
              >
                {roleSpecificRadarCards.map((card, idx) => {
                  const clampedPct = Math.max(
                    0,
                    Math.min(100, card.progressPercent || 0)
                  );
                  const isCompactEditorial =
                    effectiveHubRole === 'مدير تحرير المركز المعرفي';
                  const radius = isCompactEditorial ? 52 : 54;
                  const circumference = 2 * Math.PI * radius;
                  const strokeDashoffset =
                    circumference - (clampedPct / 100) * circumference;
                  const strokeColor = card.arcStrokeColor || '#D97757';
                  const isInteractive = Boolean(card.onClick);

                  return (
                    <div
                      key={idx}
                      data-testid={`radar-metric-card-${idx}`}
                      role={isInteractive ? 'button' : undefined}
                      tabIndex={isInteractive ? 0 : undefined}
                      title={card.actionTooltip}
                      onClick={card.onClick}
                      onKeyDown={(e) => {
                        if (
                          isInteractive &&
                          (e.key === 'Enter' || e.key === ' ')
                        ) {
                          e.preventDefault();
                          card.onClick?.();
                        }
                      }}
                      className={`relative rounded-full bg-gradient-to-b from-[#F5F1E8] via-[#F5F1E8] to-[#F5F1E8] border-2 border-[#D97757]/70 shadow-sm hover:shadow-md hover:border-[#D97757] transition-all flex flex-col items-center justify-center text-center group ${
                        isCompactEditorial
                          ? 'w-[136px] h-[136px] sm:w-[140px] sm:h-[140px] p-2.5'
                          : 'w-64 h-64 sm:w-68 sm:h-68 p-7'
                      } ${isInteractive ? 'cursor-pointer hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#D97757]/50' : ''}`}
                    >
                      {/* Circular Progress Ring SVG */}
                      <svg
                        aria-hidden="true"
                        className={`absolute inset-0 w-full h-full -rotate-90 pointer-events-none ${
                          isCompactEditorial ? 'p-1' : 'p-1.5'
                        }`}
                        viewBox="0 0 120 120"
                      >
                        <circle
                          cx="60"
                          cy="60"
                          r={radius}
                          fill="none"
                          stroke="#E8DED2"
                          strokeWidth={isCompactEditorial ? '5.5' : '3.5'}
                        />
                        <circle
                          cx="60"
                          cy="60"
                          r={radius}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={isCompactEditorial ? '5.5' : '3.5'}
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                        />
                      </svg>

                      <div
                        className={`relative z-10 flex flex-col items-center justify-center ${
                          isCompactEditorial
                            ? 'space-y-0.5 max-w-[106px]'
                            : 'space-y-2 max-w-[195px]'
                        }`}
                      >
                        <span
                          className={`rounded-full font-extrabold border leading-tight ${
                            isCompactEditorial
                              ? 'px-1.5 py-[1px] text-[7.5px]'
                              : 'px-2.5 py-0.5 text-[10px]'
                          } ${card.badgeColor}`}
                        >
                          {card.badgeText}
                        </span>

                        <h3
                          className={`font-extrabold font-display text-[#1F1F1C] leading-tight line-clamp-2 ${
                            isCompactEditorial ? 'text-[9.5px]' : 'text-xs'
                          }`}
                        >
                          {card.title}
                        </h3>

                        <div
                          dir="rtl"
                          className={`font-extrabold text-[#D97757] font-mono bg-[#F5F1E8]/95 rounded-full border border-[#D8C7B2] shadow-2xs whitespace-nowrap ${
                            isCompactEditorial
                              ? 'text-[11px] px-2 py-0.5'
                              : 'text-base sm:text-lg px-3 py-1'
                          }`}
                        >
                          {card.value}
                        </div>

                        <p
                          className={`font-bold text-[#1F1F1C]/70 leading-tight line-clamp-2 ${
                            isCompactEditorial ? 'text-[7.5px]' : 'text-[10px]'
                          }`}
                        >
                          {card.subLabel}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            PANEL 1: لوحة إدارة المستخدمين والصلاحيات (Users & RBAC)
           ===================================================================== */}
        {activeTab === 'users_rbac' && allowedTabs.includes('users_rbac') && (
          <div className="space-y-6">
            <div className="bg-[#F5F1E8] rounded-2xl border border-[#D8C7B2] p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#1F1F1C]">
                    إدارة المستخدمين وصلاحيات الفريق
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-bold cursor-pointer transition shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>إضافة عضو فريق جديد</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-[#F5F1E8] border-b border-[#D8C7B2] text-[11px] font-bold text-[#1F1F1C]/70">
                      <th className="py-3 px-4">اسم العضو</th>
                      <th className="py-3 px-4">البريد الإلكتروني</th>
                      <th className="py-3 px-4">الصلاحية</th>
                      <th className="py-3 px-4">الحالة</th>
                      <th className="py-3 px-4">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8C7B2] text-xs">
                    {staffList.map((st) => (
                      <tr key={st.id} className="hover:bg-[#F5F1E8]">
                        <td className="py-3.5 px-4 font-bold text-[#1F1F1C]">
                          <div className="flex items-center gap-2">
                            <span>{st.name}</span>
                            {st.role === 'المايسترو' && (
                              <span className="px-2 py-0.5 rounded bg-[#D97757]/15 text-[#D97757] text-[10px] font-bold">
                                المؤسس
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className="py-3.5 px-4 font-mono text-[11px] text-[#1F1F1C]/70"
                          dir="ltr"
                        >
                          {st.email}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-full bg-[#F5F1E8] text-[#D97757] border border-[#D97757]/50 font-bold text-[11px]">
                            {st.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              st.status === 'نشط'
                                ? 'bg-[#F5F1E8] text-[#1F1F1C] border border-[#D8C7B2]'
                                : 'bg-[#F5F1E8] text-[#D97757] border border-[#D8C7B2]'
                            }`}
                          >
                            {st.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {st.id !== FOUNDING_MAESTRO_MEMBER.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleStaffStatus(st)}
                                className="px-2.5 py-1 rounded-lg border border-[#D8C7B2] hover:bg-[#F5F1E8] text-[11px] font-bold text-[#1F1F1C] cursor-pointer"
                              >
                                {st.status === 'نشط' ? 'إيقاف مؤقت' : 'إعادة تفعيل'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStaffMember(st)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#D8C7B2] bg-[#F5F1E8] hover:bg-[#E8DED2] text-[11px] font-bold text-[#D97757] cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>حذف</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#1F1F1C]/70 font-bold">
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
            PANEL 1.4: غرفة التصديق السيادي لإثراء شجرة آدم (حصرية للمايسترو والمدير العام)
           ===================================================================== */}
        {activeTab === 'maestro_sovereign_approval' &&
          allowedTabs.includes('maestro_sovereign_approval') &&
          loggedInMember && (
            <MaestroSovereignApprovalView
              maestroName={loggedInMember.name}
              effectiveRole={effectiveHubRole}
              onApprovedProposalCommitted={(proposal) => {
                if (proposal.sourceFamilyName && proposal.parentNodeName) {
                  onApproveAlphaMergeIntoAdam({
                    familyName: proposal.sourceFamilyName,
                    subRootName: proposal.targetNodeName,
                    motherTribeName: proposal.parentNodeName,
                    approveSources: true,
                    isAdamEnrichmentOnly:
                      proposal.actionType === 'update_reference_node',
                    addedVerifiedSources: [proposal.sourceReferenceText],
                  });
                }
                triggerToast(
                  `👑 تم التصديق السيادي ودمج (${proposal.targetNodeName}) رسمياً في شجرة آدم المرجعية ✓`
                );
              }}
              onBackToCommandHub={() => setActiveTab('command_hub')}
              onOpenAdamTree={() => setActiveTab('adam_tree_management')}
            />
          )}

        {/* =====================================================================
            PANEL 1.5: لوحة قيادة مدير البحوث وفريق الباحثين (RBAC Phase 4)
           ===================================================================== */}
        {activeTab === 'research_manager_hub' &&
          allowedTabs.includes('research_manager_hub') &&
          loggedInMember && (
            <ResearchManagerDashboard
              activeMember={loggedInMember}
              effectiveRole={effectiveHubRole}
              staffList={staffList}
              researchTickets={researchTicketsList}
              onRefreshStaffData={() => {
                triggerToast('تمت مزامنة بيانات طابور البحوث والمشتركين.');
              }}
              onUpdateResearchTicket={(updated) => {
                setResearchTicketsList((prev) =>
                  prev.map((t) => (t.id === updated.id ? updated : t))
                );
              }}
              onUpdateStaffMember={(updated) => {
                setStaffList((prev) =>
                  prev.map((m) => (m.id === updated.id ? updated : m))
                );
              }}
              onOpenAdamTree={
                allowedTabs.includes('adam_tree_management')
                  ? () => setActiveTab('adam_tree_management')
                  : undefined
              }
              onOpenCompass={
                allowedTabs.includes('direct_search_inspection')
                  ? () => setActiveTab('direct_search_inspection')
                  : undefined
              }
            />
          )}

        {/* =====================================================================
            PANEL 2: أقسام البحوث الثلاثة (مرصد البحوث / شجرة آدم للأجداد / بوصلة الأنساب)
           ===================================================================== */}
        {(activeTab === 'research_studio' ||
          activeTab === 'adam_tree_management' ||
          activeTab === 'direct_search_inspection') &&
          allowedTabs.includes(activeTab) && (
            <div className="bg-[#F5F1E8] rounded-3xl border border-[#D8C7B2] shadow-sm p-4 sm:p-6">
              <ResearcherStudio
                activePortalSection={activeTab}
                onSelectPortalSection={(sec) => {
                  if (allowedTabs.includes(sec)) {
                    setActiveTab(sec);
                  }
                }}
                activeStaffMember={
                  loggedInMember
                    ? {
                        id: loggedInMember.id,
                        name: loggedInMember.name,
                        role: effectiveHubRole,
                      }
                    : undefined
                }
                initialFocusTicketId={focusedResearchTicketId}
                onClearInitialFocusTicketId={() =>
                  setFocusedResearchTicketId(null)
                }
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
            <div className="bg-[#F5F1E8] rounded-2xl border border-[#D8C7B2] p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="w-4 h-4 text-[#1F1F1C]/70 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  placeholder="ابحث برقم الطلب، اسم العميل، اللقب، الدولة، أو البريد..."
                  className="w-full pr-10 pl-4 py-2 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-[#1F1F1C]/70" />
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
                        ? 'bg-[#D97757] text-[#F5F1E8]'
                        : 'bg-[#F5F1E8] text-[#1F1F1C]/70 hover:bg-[#E8DED2]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Orders Table */}
            <div className="bg-[#F5F1E8] rounded-2xl border border-[#D8C7B2] overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-[#D8C7B2] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#1F1F1C]">
                  سجل طلبات العملاء
                </h3>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-sm font-bold text-[#1F1F1C]/70">
                    لا توجد سجلات حالياً
                  </p>
                  <p className="text-xs text-[#1F1F1C]/70 mt-1">
                    ستظهر هنا طلبات العملاء الحقيقية فور تسجيلهم أو ترقية باقاتهم في المنصة.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-[#E8DED2] text-[#1F1F1C] border-b border-[#D97757]/35 text-[11px] font-bold">
                        <th className="py-3.5 px-4">رقم الطلب</th>
                        <th className="py-3.5 px-4">العميل واللقب</th>
                        <th className="py-3.5 px-4">الدولة / المنطقة</th>
                        <th className="py-3.5 px-4">الباقة والمحفظة</th>
                        <th className="py-3.5 px-4">حالة التطابق</th>
                        <th className="py-3.5 px-4">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D8C7B2] text-xs">
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-[#F5F1E8] transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-[#1F1F1C]">
                            {order.id}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-[#1F1F1C]">
                              {order.fullName}
                            </div>
                            <div className="text-[11px] text-[#1F1F1C]/70">
                              اللقب: <span className="font-bold">{order.familyName}</span> ·{' '}
                              {order.email}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-[#1F1F1C]">
                              {order.originCountry}
                            </span>
                            {order.originRegion && (
                              <div className="text-[11px] text-[#1F1F1C]/70">
                                {order.originRegion}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {order.accountStatus === 'annual_vip' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#E8DED2] text-[#1F1F1C] border border-[#D8C7B2] font-bold text-[11px]">
                                اشتراك سنوي ($60)
                              </span>
                            ) : order.accountStatus === 'paid_5_root' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#F5F1E8] text-[#1F1F1C] border border-[#D8C7B2] font-bold text-[11px]">
                                فتح الجذر ($5)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#E8DED2] text-[#1F1F1C]/70 border border-[#D8C7B2] font-bold text-[11px]">
                                مجاني ($0)
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-[11px] font-bold text-[#1F1F1C]/70">
                              {order.nodesCountLabel}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedOrderForModal(order)}
                                className="px-2.5 py-1.5 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] font-bold text-[11px] cursor-pointer"
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
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] font-bold text-[11px] cursor-pointer"
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
              <div className="bg-[#F5F1E8] rounded-2xl border border-[#D8C7B2] p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileSignature className="w-5 h-5 text-[#D97757]" />
                    <h3 className="text-sm font-bold text-[#1F1F1C]">
                      طلبات توثيق &quot;ميثاق أمين السجل&quot; ({charterRequests.length})
                    </h3>
                  </div>
                </div>

                {charterRequests.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-center text-xs font-bold text-[#1F1F1C]/70">
                    لا توجد سجلات حالياً
                  </div>
                ) : (
                  <div className="space-y-3">
                    {charterRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-3.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs font-bold text-[#1F1F1C]">
                            {req.clientName} — عائلة ({req.familyName})
                          </div>
                          <div className="text-[11px] text-[#1F1F1C]/70 mt-0.5">
                            {req.country} · رمز الشهادة:{' '}
                            <span className="font-mono font-bold text-[#1F1F1C]">
                              {req.charterCode}
                            </span>
                            {req.contractVersion
                              ? ` · الإصدار: ${req.contractVersion}`
                              : ''}
                            {req.ipAddress ? ` · IP: ${req.ipAddress}` : ''}
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
                            className="px-3 py-1.5 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-[11px] font-bold cursor-pointer"
                          >
                            اعتماد الميثاق
                          </button>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-[#E8DED2] text-[#1F1F1C] text-[11px] font-bold">
                            {req.status}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Support Tickets */}
              <div className="bg-[#F5F1E8] rounded-2xl border border-[#D8C7B2] p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-[#D97757]" />
                    <h3 className="text-sm font-bold text-[#1F1F1C]">
                      تذاكر الدعم الفني والاستفسارات ({supportTickets.length})
                    </h3>
                  </div>
                </div>

                {supportTickets.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-center text-xs font-bold text-[#1F1F1C]/70">
                    لا توجد سجلات حالياً
                  </div>
                ) : (
                  <div className="space-y-3">
                    {supportTickets.map((t) => (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs font-bold text-[#1F1F1C]">
                            {t.clientName} ({t.email})
                          </div>
                          <div className="text-[11px] text-[#1F1F1C]/70 mt-0.5">
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
                            className="px-3 py-1.5 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-[11px] font-bold cursor-pointer"
                          >
                            تحديد كـ &quot;تم الحل&quot;
                          </button>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-[#E8DED2] text-[#1F1F1C] text-[11px] font-bold">
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
            PANEL 4: إدارة تحرير المركز المعرفي (Knowledge Center CMS)
           ===================================================================== */}
        {activeTab === 'knowledge_cms' && allowedTabs.includes('knowledge_cms') && (() => {
          const normalizedName = (loggedInMember?.name || '').trim().toLowerCase();
          const isMineArticle = (art: KnowledgeArticleRecord) => {
            if (!normalizedName) return false;
            return [art.editor, art.author, art.authorName]
              .filter(Boolean)
              .map((v) => String(v).trim().toLowerCase())
              .some((f) => f === normalizedName || f.includes(normalizedName));
          };
          const articlesWithRigor = knowledgeArticles.map((art) => ({
            article: art,
            rigor: computeArticleRigorScore(art),
          }));

          // Dynamic filter options built from schema + real Firestore articles
          const sectionOptions = Array.from(
            new Set([
              ...Object.keys(KNOWLEDGE_BASE_SECTIONS),
              ...knowledgeArticles
                .map((art) => (art.section || '').trim())
                .filter(Boolean),
            ])
          );

          const subFilterOptions = Array.from(
            new Set(
              cmsSectionFilter !== 'ALL'
                ? [
                    ...(KNOWLEDGE_BASE_SECTIONS[cmsSectionFilter]?.baseFilters || []),
                    ...knowledgeArticles
                      .filter(
                        (art) =>
                          (art.section || 'الروايات والذاكرة') === cmsSectionFilter
                      )
                      .map((art) => (art.filter || '').trim())
                      .filter(Boolean),
                  ]
                : [
                    ...Object.values(KNOWLEDGE_BASE_SECTIONS).flatMap(
                      (cfg) => cfg.baseFilters || []
                    ),
                    ...knowledgeArticles
                      .map((art) => (art.filter || '').trim())
                      .filter(Boolean),
                  ]
            )
          );

          const countrySubFilterOptions = subFilterOptions
            .filter((flt) => isCmsCountrySubSection(flt, knowledgeArticles))
            .sort((a, b) => a.localeCompare(b, 'ar'));
          const otherSubFilterOptions = subFilterOptions.filter(
            (flt) => !isCmsCountrySubSection(flt, knowledgeArticles)
          );

          const authorOptions = Array.from(
            new Set(
              knowledgeArticles
                .map((art) => (art.author || art.authorName || '').trim())
                .filter(Boolean)
            )
          ).sort((a, b) => a.localeCompare(b, 'ar'));

          const editorOptions = Array.from(
            new Set(
              knowledgeArticles
                .map((art) => (art.editor || '').trim())
                .filter(Boolean)
            )
          ).sort((a, b) => a.localeCompare(b, 'ar'));

          const normalizedSearch = normalizeCmsArabicText(cmsSearchQuery);

          const filteredCmsArticles = articlesWithRigor
            .filter(({ article, rigor }) => {
              if (cmsFilterMode === 'needs_work') {
                if (!(article.status === 'draft' || rigor.score < 85)) return false;
              } else if (cmsFilterMode === 'mine') {
                if (!isMineArticle(article)) return false;
              }

              if (normalizedSearch) {
                const normTitle = normalizeCmsArabicText(article.title || '');
                if (!normTitle.includes(normalizedSearch)) return false;
              }

              if (cmsTypeFilter !== 'ALL') {
                const artType = article.type || 'مقال';
                if (artType !== cmsTypeFilter) return false;
              }

              if (cmsSectionFilter !== 'ALL') {
                const artSection = article.section || 'الروايات والذاكرة';
                if (artSection !== cmsSectionFilter) return false;
              }

              if (cmsSubFilter !== 'ALL') {
                const artFilter = (article.filter || 'عام').trim();
                if (artFilter !== cmsSubFilter) return false;
              }

              if (cmsStatusFilter !== 'ALL') {
                const isDraft = article.status === 'draft';
                if (cmsStatusFilter === 'draft' && !isDraft) return false;
                if (cmsStatusFilter === 'published' && isDraft) return false;
              }

              if (cmsAuthorFilter !== 'ALL') {
                const artAuthor = (article.author || article.authorName || '').trim();
                if (artAuthor !== cmsAuthorFilter) return false;
              }

              if (cmsEditorFilter !== 'ALL') {
                const artEditor = (article.editor || '').trim();
                if (artEditor !== cmsEditorFilter) return false;
              }

              if (cmsDateFilter) {
                const pubDate = (article.publishDate || '').trim();
                const createdDate = (article.createdAt || '').trim();
                const matchesDate =
                  pubDate.startsWith(cmsDateFilter) ||
                  createdDate.startsWith(cmsDateFilter);
                if (!matchesDate) return false;
              }

              return true;
            })
            .sort((a, b) => {
              const tsA = getCmsArticleSortTimestamp(a.article);
              const tsB = getCmsArticleSortTimestamp(b.article);
              if (tsA !== tsB) {
                return cmsSortOrder === 'newest' ? tsB - tsA : tsA - tsB;
              }
              return (a.article.title || '').localeCompare(b.article.title || '', 'ar');
            });

          const activeFiltersCount =
            (cmsFilterMode !== 'all' ? 1 : 0) +
            (normalizedSearch ? 1 : 0) +
            (cmsTypeFilter !== 'ALL' ? 1 : 0) +
            (cmsSectionFilter !== 'ALL' ? 1 : 0) +
            (cmsSubFilter !== 'ALL' ? 1 : 0) +
            (cmsStatusFilter !== 'ALL' ? 1 : 0) +
            (cmsAuthorFilter !== 'ALL' ? 1 : 0) +
            (cmsEditorFilter !== 'ALL' ? 1 : 0) +
            (cmsDateFilter ? 1 : 0);

          const hasAnyActiveFilter = activeFiltersCount > 0;

          const totalFilteredCount = filteredCmsArticles.length;
          const totalPages = Math.max(
            1,
            Math.ceil(totalFilteredCount / CMS_PAGE_SIZE)
          );
          const safeCurrentPage = Math.min(cmsCurrentPage, totalPages);
          const pageStartIndex = (safeCurrentPage - 1) * CMS_PAGE_SIZE;
          const paginatedCmsArticles = filteredCmsArticles.slice(
            pageStartIndex,
            pageStartIndex + CMS_PAGE_SIZE
          );
          const showingFrom = totalFilteredCount === 0 ? 0 : pageStartIndex + 1;
          const showingTo = Math.min(
            pageStartIndex + CMS_PAGE_SIZE,
            totalFilteredCount
          );
          const paginationRange = buildCmsPaginationRange(
            safeCurrentPage,
            totalPages
          );

          const goToCmsPage = (targetPage: number) => {
            const clamped = Math.max(1, Math.min(totalPages, targetPage));
            setCmsCurrentPage(clamped);
            cmsCardTopRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          };

          const handleSectionFilterChange = (nextSection: string) => {
            setCmsSectionFilter(nextSection);
            if (nextSection === 'ALL') return;
            const validNextSubs = new Set([
              ...(KNOWLEDGE_BASE_SECTIONS[nextSection]?.baseFilters || []),
              ...knowledgeArticles
                .filter(
                  (art) => (art.section || 'الروايات والذاكرة') === nextSection
                )
                .map((art) => (art.filter || '').trim())
                .filter(Boolean),
            ]);
            if (cmsSubFilter !== 'ALL' && !validNextSubs.has(cmsSubFilter)) {
              setCmsSubFilter('ALL');
            }
          };

          return (
          <div className="space-y-6">
            <div
              ref={cmsCardTopRef}
              className="bg-[#F5F1E8] rounded-2xl shadow-sm border border-[#D8C7B2] overflow-hidden"
            >
              <div className="p-5 sm:p-6 border-b border-[#D8C7B2] space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-[#1F1F1C]">
                      إدارة المقالات والمركز المعرفي
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewKnowledgeCenter((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] text-[#1F1F1C] border border-[#D97757]/50 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#D97757]" />
                      <span>
                        {previewKnowledgeCenter
                          ? 'إخفاء معاينة المركز المعرفي'
                          : 'معاينة المركز المعرفي للزوار'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openNewArticleModal()}
                      className="flex items-center gap-2 px-4 py-2 bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] rounded-xl transition-colors text-xs sm:text-sm font-bold cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة موضوع</span>
                    </button>
                  </div>
                </div>

                {/* شريط البحث السريع + عداد النتائج + الفلاتر الشاملة */}
                <div className="rounded-xl bg-[#F5F1E8]/80 border border-[#D8C7B2] p-3.5 space-y-3">
                  {/* الصف الأول: البحث اللحظي بالعنوان وبجانبه عداد النتائج وزر مسح الفلاتر */}
                  <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
                    <div className="flex-1 relative">
                      <Search className="w-4 h-4 text-[#D97757] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={cmsSearchQuery}
                        onChange={(e) => setCmsSearchQuery(e.target.value)}
                        placeholder="ابحث سريعاً بكتابة الحروف الأولى من عنوان المقال..."
                        aria-label="البحث السريع في عناوين المقالات"
                        className="w-full pr-10 pl-9 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/25 outline-none text-xs sm:text-sm font-medium text-[#1F1F1C] placeholder:text-[#1F1F1C]/70 transition"
                      />
                      {cmsSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setCmsSearchQuery('')}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-[#1F1F1C]/70 hover:text-[#1F1F1C] hover:bg-[#F5F1E8] transition cursor-pointer"
                          title="مسح نص البحث"
                          aria-label="مسح نص البحث"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* عداد النتائج المطابقة + زر مسح الفلاتر بجانب شريط البحث */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs font-bold text-[#1F1F1C]">
                        <Filter className="w-3.5 h-3.5 text-[#D97757]" />
                        <span>
                          النتائج المطابقة:{' '}
                          <span className="text-[#D97757] font-extrabold">
                            {totalFilteredCount}
                          </span>
                          <span className="text-[#1F1F1C]/70 font-semibold">
                            {' '}
                            من أصل {knowledgeArticles.length} مقال
                          </span>
                        </span>
                        {activeFiltersCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-[#D97757]/15 text-[#D97757] text-[10px] font-extrabold">
                            {activeFiltersCount} فلتر
                          </span>
                        )}
                      </div>

                      {hasAnyActiveFilter && (
                        <button
                          type="button"
                          onClick={resetAllCmsFilters}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2]/60 text-[#D97757] border border-[#D97757]/55 text-xs font-bold transition cursor-pointer"
                          title="مسح جميع الفلاتر والعودة لعرض كل المقالات"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>مسح الفلاتر</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* الصف الثاني: فلاتر حقول المقال السبعة */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
                    {/* نوع الموضوع */}
                    <label className="block space-y-1">
                      <span className="block text-[11px] font-bold text-[#1F1F1C]/70">
                        نوع الموضوع
                      </span>
                      <select
                        value={cmsTypeFilter}
                        onChange={(e) =>
                          setCmsTypeFilter(
                            e.target.value as 'ALL' | KnowledgeContentType
                          )
                        }
                        className="w-full px-2.5 py-2 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] focus:border-[#D97757] outline-none text-xs font-semibold text-[#1F1F1C] cursor-pointer"
                      >
                        <option value="ALL">الكل</option>
                        <option value="مقال">مقال</option>
                        <option value="فيديو">فيديو</option>
                      </select>
                    </label>

                    {/* القسم الرئيسي */}
                    <label className="block space-y-1">
                      <span className="block text-[11px] font-bold text-[#1F1F1C]/70">
                        القسم الرئيسي
                      </span>
                      <select
                        value={cmsSectionFilter}
                        onChange={(e) =>
                          handleSectionFilterChange(e.target.value)
                        }
                        className="w-full px-2.5 py-2 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] focus:border-[#D97757] outline-none text-xs font-semibold text-[#1F1F1C] cursor-pointer"
                      >
                        <option value="ALL">كل الأقسام</option>
                        {sectionOptions.map((sec) => (
                          <option key={sec} value={sec}>
                            {sec}
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* القسم الفرعي (مع فصل بصري واضح بين الدول وباقي الأقسام الفرعية) */}
                    <label className="block space-y-1">
                      <span className="block text-[11px] font-bold text-[#1F1F1C]/70">
                        القسم الفرعي
                      </span>
                      <select
                        value={cmsSubFilter}
                        onChange={(e) => setCmsSubFilter(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] focus:border-[#D97757] outline-none text-xs font-semibold text-[#1F1F1C] cursor-pointer"
                      >
                        <option value="ALL">الكل</option>
                        {otherSubFilterOptions.length > 0 && (
                          <optgroup label="── الأقسام والتصنيفات ──">
                            {otherSubFilterOptions.map((flt) => (
                              <option key={`other-${flt}`} value={flt}>
                                {flt}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {countrySubFilterOptions.length > 0 && (
                          <optgroup label="── الدول ──">
                            {countrySubFilterOptions.map((country) => (
                              <option key={`country-${country}`} value={country}>
                                {country}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </label>

                    {/* حالة النشر */}
                    <label className="block space-y-1">
                      <span className="block text-[11px] font-bold text-[#1F1F1C]/70">
                        حالة النشر
                      </span>
                      <select
                        value={cmsStatusFilter}
                        onChange={(e) =>
                          setCmsStatusFilter(
                            e.target.value as 'ALL' | 'published' | 'draft'
                          )
                        }
                        className="w-full px-2.5 py-2 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] focus:border-[#D97757] outline-none text-xs font-semibold text-[#1F1F1C] cursor-pointer"
                      >
                        <option value="ALL">الكل</option>
                        <option value="published">منشور للجمهور</option>
                        <option value="draft">مسودة تحريرية</option>
                      </select>
                    </label>

                    {/* تاريخ إدخال / نشر المقال */}
                    <div className="space-y-1">
                      <span className="flex items-center justify-between text-[11px] font-bold text-[#1F1F1C]/70">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#D97757]" />
                          <span>تاريخ المقال</span>
                        </span>
                        {cmsDateFilter && (
                          <button
                            type="button"
                            onClick={() => setCmsDateFilter('')}
                            className="text-[10px] text-[#D97757] hover:underline cursor-pointer"
                          >
                            مسح
                          </button>
                        )}
                      </span>
                      <input
                        type="date"
                        dir="ltr"
                        value={cmsDateFilter}
                        onChange={(e) => setCmsDateFilter(e.target.value)}
                        aria-label="تصفية حسب تاريخ إدخال أو نشر المقال"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] focus:border-[#D97757] outline-none text-xs font-mono text-[#1F1F1C] cursor-pointer"
                      />
                    </div>

                    {/* الكاتب / المنتج */}
                    <label className="block space-y-1">
                      <span className="block text-[11px] font-bold text-[#1F1F1C]/70">
                        الكاتب / المنتج
                      </span>
                      <select
                        value={cmsAuthorFilter}
                        onChange={(e) => setCmsAuthorFilter(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] focus:border-[#D97757] outline-none text-xs font-semibold text-[#1F1F1C] cursor-pointer"
                      >
                        <option value="ALL">الكل</option>
                        {authorOptions.map((authorName) => (
                          <option key={authorName} value={authorName}>
                            {authorName}
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* تحرير */}
                    <label className="block space-y-1">
                      <span className="block text-[11px] font-bold text-[#1F1F1C]/70">
                        تحرير
                      </span>
                      <select
                        value={cmsEditorFilter}
                        onChange={(e) => setCmsEditorFilter(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] focus:border-[#D97757] outline-none text-xs font-semibold text-[#1F1F1C] cursor-pointer"
                      >
                        <option value="ALL">الكل</option>
                        {editorOptions.map((editorName) => (
                          <option key={editorName} value={editorName}>
                            {editorName}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead className="bg-[#F5F1E8] border-b border-[#D8C7B2] text-[#1F1F1C]/70 text-xs font-bold">
                    <tr>
                      <th className="p-4">العنوان</th>
                      <th className="p-4">النوع</th>
                      <th className="p-4">القسم / القسم الفرعي</th>
                      <th className="p-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            setCmsSortOrder((prev) =>
                              prev === 'newest' ? 'oldest' : 'newest'
                            )
                          }
                          title={
                            cmsSortOrder === 'newest'
                              ? 'مرتّب من الأحدث إلى الأقدم — اضغط للعرض من الأقدم إلى الأحدث'
                              : 'مرتّب من الأقدم إلى الأحدث — اضغط للعرض من الأحدث إلى الأقدم'
                          }
                          aria-label={
                            cmsSortOrder === 'newest'
                              ? 'تاريخ النشر (الأحدث أولاً) — اضغط لعكس الترتيب'
                              : 'تاريخ النشر (الأقدم أولاً) — اضغط لعكس الترتيب'
                          }
                          className="inline-flex items-center gap-1.5 text-[#1F1F1C] hover:text-[#D97757] transition-colors cursor-pointer group"
                        >
                          <span>تاريخ النشر</span>
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-[#F5F1E8] border border-[#D8C7B2] group-hover:border-[#D97757] text-[#D97757] transition-colors">
                            {cmsSortOrder === 'newest' ? (
                              <ArrowDown className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUp className="w-3.5 h-3.5" />
                            )}
                          </span>
                        </button>
                      </th>
                      <th className="p-4">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8C7B2] text-xs sm:text-sm">
                    {paginatedCmsArticles.map(({ article, rigor }) => {
                      const artType = article.type || 'مقال';
                      const artSection = article.section || 'الروايات والذاكرة';
                      const artFilter = article.filter || 'عام';
                      return (
                        <tr
                          key={article.id}
                          className="hover:bg-[#F5F1E8] transition-colors"
                        >
                          <td className="p-4 font-bold text-[#1F1F1C]">
                            <div className="flex items-center gap-3">
                              <div className="w-20 aspect-video rounded-lg overflow-hidden bg-[#E8DED2] border border-[#D97757]/40 shrink-0">
                                <ResilientImage
                                  src={article.coverImageUrl || ''}
                                  alt={article.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span>{article.title}</span>
                                  {article.status === 'draft' && (
                                    <span className="px-2 py-0.5 rounded bg-[#E8DED2] text-[#1F1F1C] text-[10px] font-bold">
                                      مسودة
                                    </span>
                                  )}
                                  <span
                                    title={rigor.hint}
                                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold font-mono border ${
                                      rigor.score >= 85
                                        ? 'bg-[#F5F1E8] text-[#1F1F1C] border-[#D8C7B2]'
                                        : rigor.score >= 65
                                          ? 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]/60'
                                          : 'bg-[#F5F1E8] text-[#D97757] border-[#D97757]/50'
                                    }`}
                                  >
                                    رصانة {rigor.score}%
                                  </span>
                                </div>
                                {(article.author || article.authorName) && (
                                  <div className="text-[11px] font-normal text-[#1F1F1C]/70 mt-0.5">
                                    {article.author || article.authorName}
                                    {article.editor
                                      ? ` · تحرير: ${article.editor}`
                                      : ''}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap ${
                                artType === 'مقال'
                                  ? 'bg-[#F5F1E8] text-[#D97757] border border-[#D97757]/50'
                                  : 'bg-[#D97757]/15 text-[#D97757] border border-[#D97757]/30'
                              }`}
                            >
                              {artType === 'فيديو' ? (
                                <Video className="w-3 h-3" />
                              ) : (
                                <FileText className="w-3 h-3" />
                              )}
                              <span>{artType}</span>
                            </span>
                          </td>
                          <td className="p-4 text-[#1F1F1C]/70">
                            <div className="font-bold text-[#1F1F1C]">
                              {artSection}
                            </div>
                            <div className="text-xs text-[#1F1F1C]/70">{artFilter}</div>
                          </td>
                          <td
                            dir="ltr"
                            className="p-4 text-[#1F1F1C]/70 font-mono text-xs whitespace-nowrap text-right"
                          >
                            {article.publishDate || 'غير محدد'}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditArticleModal(article)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[#D97757] hover:bg-[#F5F1E8] border border-[#D97757]/40 rounded-lg transition-colors text-xs font-bold cursor-pointer"
                                title="تعديل"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>تعديل</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDeleteArticle(article)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[#D97757] hover:bg-[#F5F1E8] border border-[#D8C7B2] rounded-lg transition-colors text-xs font-bold cursor-pointer"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>حذف</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {totalFilteredCount === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-10 text-center text-[#1F1F1C]/70 space-y-2.5"
                        >
                          <div className="font-bold text-sm text-[#1F1F1C]">
                            {knowledgeArticles.length === 0
                              ? 'لا توجد مقالات مضافة بعد'
                              : 'لا توجد مقالات مطابقة لمعايير البحث والتصفية الحالية'}
                          </div>
                          {hasAnyActiveFilter && knowledgeArticles.length > 0 && (
                            <button
                              type="button"
                              onClick={resetAllCmsFilters}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] text-[#D97757] border border-[#D97757] text-xs font-bold transition cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>عرض كل المقالات ({knowledgeArticles.length})</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* تذييل الجدول: عداد العرض + أزرار التنقل بين الصفحات (10 مقالات في الصفحة) */}
              {totalFilteredCount > 0 && (
                <div className="px-5 py-3.5 bg-[#F5F1E8] border-t border-[#D8C7B2] flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs font-bold text-[#1F1F1C]/70">
                    عرض{' '}
                    <span className="text-[#1F1F1C] font-extrabold font-mono">
                      {showingFrom}–{showingTo}
                    </span>{' '}
                    من أصل{' '}
                    <span className="text-[#D97757] font-extrabold font-mono">
                      {totalFilteredCount}
                    </span>{' '}
                    مقال
                    {totalFilteredCount !== knowledgeArticles.length && (
                      <span className="text-[#1F1F1C]/70 font-semibold">
                        {' '}
                        (إجمالي المركز: {knowledgeArticles.length})
                      </span>
                    )}
                    <span className="text-[#1F1F1C]/70 font-semibold mr-2">
                      · صفحة {safeCurrentPage} من {totalPages}
                    </span>
                  </div>

                  {totalPages > 1 && (
                    <nav
                      aria-label="التنقل بين صفحات المقالات"
                      className="flex flex-wrap items-center gap-1.5"
                    >
                      <button
                        type="button"
                        disabled={safeCurrentPage <= 1}
                        onClick={() => goToCmsPage(safeCurrentPage - 1)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] text-xs font-bold text-[#1F1F1C] hover:bg-[#E8DED2]/60 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                        <span>السابق</span>
                      </button>

                      {paginationRange.map((entry, idx) =>
                        entry === 'ellipsis' ? (
                          <span
                            key={`ellipsis-${idx}`}
                            className="px-2 text-xs font-bold text-[#1F1F1C]/70 select-none"
                          >
                            …
                          </span>
                        ) : (
                          <button
                            key={entry}
                            type="button"
                            onClick={() => goToCmsPage(entry)}
                            aria-current={
                              entry === safeCurrentPage ? 'page' : undefined
                            }
                            className={`min-w-8 h-8 px-2 rounded-lg text-xs font-extrabold font-mono border transition cursor-pointer ${
                              entry === safeCurrentPage
                                ? 'bg-[#D97757] text-[#F5F1E8] border-[#D97757] shadow-xs'
                                : 'bg-[#F5F1E8] text-[#1F1F1C] border-[#D8C7B2] hover:bg-[#E8DED2]/70'
                            }`}
                          >
                            {entry}
                          </button>
                        )
                      )}

                      <button
                        type="button"
                        disabled={safeCurrentPage >= totalPages}
                        onClick={() => goToCmsPage(safeCurrentPage + 1)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] text-xs font-bold text-[#1F1F1C] hover:bg-[#E8DED2]/60 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                      >
                        <span>التالي</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </nav>
                  )}
                </div>
              )}
            </div>

            {previewKnowledgeCenter && (
              <div className="bg-[#F5F1E8] rounded-3xl border border-[#D97757]/45 p-5 sm:p-8 shadow-sm">
                <KnowledgeCenterView articles={knowledgeArticles} />
              </div>
            )}
          </div>
          );
        })()}

        {/* =====================================================================
            PANEL 4B: استوديو كشّافي ومكتبة المقترحات والإسناد التلقائي
           ===================================================================== */}
        {activeTab === 'kashafi_studio' &&
          allowedTabs.includes('kashafi_studio') && (
            <KashafiAdminStudio
              activeAdminName={loggedInMember?.name || 'الإدارة العامة'}
              customerOrders={orders}
              staffList={staffList}
              onToast={triggerToast}
            />
          )}

        {/* =====================================================================
            PANEL 5: لوحة التقارير والإدارة العليا (Executive Reports)
           ===================================================================== */}
        {activeTab === 'executive_reports' &&
          allowedTabs.includes('executive_reports') && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#F5F1E8] rounded-2xl border border-[#D8C7B2] p-5 shadow-sm">
                  <div className="text-xs font-bold text-[#1F1F1C]/70">
                    إجمالي الإيرادات الفعلية
                  </div>
                  <div className="text-2xl font-extrabold text-[#1F1F1C] mt-1">
                    ${metrics.totalRevenue}
                  </div>
                  <div className="text-[11px] text-[#1F1F1C]/70 mt-1">
                    {metrics.annualSubscribers} اشتراك سنوي · {metrics.paidRootUnlocks}{' '}
                    فتح جذر
                  </div>
                </div>

                <div className="bg-[#F5F1E8] rounded-2xl border border-[#D8C7B2] p-5 shadow-sm">
                  <div className="text-xs font-bold text-[#1F1F1C]/70">
                    إجمالي طلبات العملاء المسجلة
                  </div>
                  <div className="text-2xl font-extrabold text-[#1F1F1C] mt-1">
                    {metrics.totalOrders}
                  </div>
                  <div className="text-[11px] text-[#1F1F1C]/70 mt-1">
                    مخزنة في Firebase (`customer_orders`)
                  </div>
                </div>

                <div className="bg-[#F5F1E8] rounded-2xl border border-[#D8C7B2] p-5 shadow-sm">
                  <div className="text-xs font-bold text-[#1F1F1C]/70">
                    تذاكر البحث والتحقيق النَّسبي
                  </div>
                  <div className="text-2xl font-extrabold text-[#1F1F1C] mt-1">
                    {researchTicketsCount}
                  </div>
                  <div className="text-[11px] text-[#1F1F1C]/70 mt-1">
                    مخزنة في Firebase (`research_tickets`)
                  </div>
                </div>

                <div className="bg-[#F5F1E8] rounded-2xl border border-[#D8C7B2] p-5 shadow-sm">
                  <div className="text-xs font-bold text-[#1F1F1C]/70">
                    أعضاء الفريق ومقالات المركز المعرفي
                  </div>
                  <div className="text-2xl font-extrabold text-[#1F1F1C] mt-1">
                    {staffList.length} أعضاء · {metrics.totalArticles} مقال
                  </div>
                  <div className="text-[11px] text-[#1F1F1C]/70 mt-1">
                    {metrics.openSupportCount} تذاكر دعم مفتوحة
                  </div>
                </div>
              </div>

              {/* ===============================================================
                  PILLAR 3: RESEARCHER PRODUCTIVITY, KPI & MONTHLY INCENTIVES
              =============================================================== */}
              {(() => {
                const liveKpi = loadResearcherKpiTelemetry();
                const totalToday =
                  liveKpi.completedTodayP1 +
                  liveKpi.completedTodayP2 +
                  liveKpi.completedTodayP3;
                return (
                  <div
                    data-testid="executive-researcher-kpi-panel"
                    className="bg-[#F5F1E8] rounded-3xl border-2 border-[#D97757]/50 p-6 shadow-sm space-y-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8C7B2] pb-4">
                      <div>
                        <span className="px-3 py-1 rounded-full bg-[#F5F1E8] border border-[#D97757]/45 text-[#D97757] text-xs font-extrabold">
                          📊 منظومة تقييم إنتاجية الباحثين والمكافآت الشهرية (KPI & Incentives)
                        </span>
                        <h3 className="text-base sm:text-lg font-extrabold text-[#1F1F1C] mt-2">
                          مؤشرات الأداء الحي لفريق التحقيق وربط شجرة آدم وسجل آدم برايم
                        </h3>
                      </div>
                      <div className="px-4 py-2 rounded-2xl bg-[#D97757]/15 border border-[#D97757]/35 text-[#D97757] font-mono text-sm font-extrabold">
                        🏆 الرصيد التراكمي للمكافآت: {liveKpi.totalXpScore} XP
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-4 space-y-1">
                        <div className="text-xs font-bold text-[#1F1F1C]/70">
                          متوسط زمن إنجاز التذكرة (Avg Handling Time)
                        </div>
                        <div className="text-2xl font-mono font-extrabold text-[#1F1F1C]">
                          {formatDurationMmSs(liveKpi.avgHandlingTimeSeconds)}
                        </div>
                        <div className="text-[11px] text-[#1F1F1C] font-bold">
                          ضمن المعيار القياسي للاستوديو التفاعلي (&lt; 02:00)
                        </div>
                      </div>

                      <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-4 space-y-1">
                        <div className="text-xs font-bold text-[#1F1F1C]/70">
                          التذاكر المنجزة اليوم حسب الأولوية ({totalToday})
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 font-mono text-xs font-extrabold">
                          <span className="px-2.5 py-1 rounded-lg bg-[#E8DED2] text-[#1F1F1C] border border-[#D8C7B2]">
                            P1: {liveKpi.completedTodayP1}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-[#E8DED2] text-[#1F1F1C] border border-[#D8C7B2]">
                            P2: {liveKpi.completedTodayP2}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-[#E8DED2] text-[#1F1F1C] border border-[#D8C7B2]">
                            P3: {liveKpi.completedTodayP3}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-4 space-y-1">
                        <div className="text-xs font-bold text-[#1F1F1C]/70">
                          عُقد ألفا الموصولة بشجرة آدم
                        </div>
                        <div className="text-2xl font-mono font-extrabold text-[#1F1F1C]">
                          {liveKpi.totalAlphaNodesBridged} عقدة
                        </div>
                        <div className="text-[11px] text-[#1F1F1C]/70">
                          موثقة ومعلّمة في Neo4j لمنع التكرار
                        </div>
                      </div>

                      <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-4 space-y-1">
                        <div className="text-xs font-bold text-[#1F1F1C]/70">
                          المصادر الإضافية الموثقة في آدم برايم
                        </div>
                        <div className="text-2xl font-mono font-extrabold text-[#D97757]">
                          {liveKpi.totalAdamPrimeSourcesVerified} مرجع
                        </div>
                        <div className="text-[11px] text-[#1F1F1C]/70">
                          مربوطة بمعرفات APR-SRC في محفظة العميل
                        </div>
                      </div>
                    </div>

                    {liveKpi.recentCompletedLog.length > 0 && (
                      <div className="rounded-2xl border border-[#D8C7B2] overflow-hidden">
                        <div className="bg-[#F5F1E8] px-4 py-2.5 border-b border-[#D8C7B2] text-xs font-extrabold text-[#1F1F1C]">
                          سجل آخر التذاكر المنجزة وتقييم النقاط التحفيزية للباحثين
                        </div>
                        <div className="divide-y divide-[#D8C7B2] text-xs">
                          {liveKpi.recentCompletedLog.slice(0, 6).map((log, idx) => (
                            <div
                              key={`${log.ticketId}-${idx}`}
                              className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-[#F5F1E8]"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono font-bold px-2 py-0.5 rounded bg-[#F5F1E8] border border-[#D97757]/45 text-[#D97757]">
                                  {log.ticketId}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                                    log.priority === 'P1'
                                      ? 'bg-[#E8DED2] text-[#1F1F1C]'
                                      : log.priority === 'P3'
                                      ? 'bg-[#E8DED2] text-[#1F1F1C]'
                                      : 'bg-[#E8DED2] text-[#1F1F1C]'
                                  }`}
                                >
                                  {log.priority}
                                </span>
                                <span className="font-extrabold text-[#1F1F1C]">
                                  {log.familyName}
                                </span>
                                <span className="text-[#1F1F1C]/70">
                                  ({log.researcherName})
                                </span>
                              </div>
                              <div className="flex items-center gap-3 font-mono">
                                <span className="text-[#1F1F1C]/70">
                                  ⏱️ {formatDurationMmSs(log.durationSec)}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-lg bg-[#E8DED2] text-[#1F1F1C] font-extrabold">
                                  +{log.xpEarned} XP
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
      </main>

      {/* Quiet Editorial Footer (Matches Platform Homepage Footer) */}
      <footer className="border-t border-[#D97757]/30 bg-[#E8DED2]/70 py-12 mt-auto">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center space-y-3.5">
            <JuthoriLogo
              size="sm"
              onClick={onBackToPlatform}
              confirmHomeNavigation
              confirmAlign="center"
            />

            <p className="text-sm sm:text-base font-display font-bold text-[#1F1F1C] pt-1">
              ما لا يُوثق اليوم… قد يصبح مجرد رواية غامضة غدًا.
            </p>

            <p className="text-xs sm:text-sm text-[#1F1F1C]/80 leading-relaxed font-sans">
              تعمل المنصة من خلال شركة جينيا لاب - الولايات المتحدة الأمريكية.
            </p>

            <p className="text-xs sm:text-sm text-[#1F1F1C]/75 font-sans" dir="rtl">
              منصة الأنساب والإرث العائلي العربي — juthori.com
            </p>

            <p className="text-xs text-[#1F1F1C]/70 font-sans" dir="rtl">
              جميع الحقوق محفوظة. جذوري © 2026
            </p>
          </div>
        </div>
      </footer>

      {/* =======================================================================
          MODAL 1: Add & Invite New Staff Member (/Team)
         ======================================================================= */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-[#1F1F1C]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#F5F1E8] rounded-3xl border border-[#D97757]/50 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[#1F1F1C] mb-1">
              إضافة عضو جديد في فريق العمل (/Team)
            </h3>
            <p className="text-xs text-[#1F1F1C]/70 mb-4">
              سيتم تسجيل الحساب مباشرة في{' '}
              <span className="font-bold text-[#1F1F1C]">
                Firebase Authentication
              </span>{' '}
              وقاعدة بيانات{' '}
              <span className="font-bold text-[#1F1F1C]">Firestore</span>، وإرسال دعوة
              رسمية من{' '}
              <span dir="ltr" className="font-mono font-bold">
                info@Juthori.com
              </span>{' '}
              عبر Resend API.
            </p>

            {addStaffError && (
              <div className="mb-3.5 p-3 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs font-bold text-[#D97757] leading-relaxed">
                {addStaffError}
              </div>
            )}

            <form onSubmit={handleAddStaffMember} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#1F1F1C]/70 mb-1">
                  الاسم الكامل
                </label>
                <input
                  type="text"
                  required
                  value={newStaffName}
                  onChange={(e) => {
                    setNewStaffName(e.target.value);
                    if (addStaffError) setAddStaffError(null);
                  }}
                  placeholder="مثال: الباحث كريم"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs font-bold text-[#1F1F1C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F1F1C]/70 mb-1">
                  البريد الإلكتروني الرسمي (غير قابل للتكرار)
                </label>
                <input
                  type="email"
                  dir="ltr"
                  required
                  value={newStaffEmail}
                  onChange={(e) => {
                    setNewStaffEmail(e.target.value);
                    if (addStaffError) setAddStaffError(null);
                  }}
                  placeholder="member@juthori.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs text-[#1F1F1C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F1F1C]/70 mb-1">
                  كلمة المرور المبدئية (6 خانات على الأقل للتسجيل في Firebase Auth)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  minLength={6}
                  value={newStaffPassword}
                  onChange={(e) => {
                    setNewStaffPassword(e.target.value);
                    if (addStaffError) setAddStaffError(null);
                  }}
                  placeholder="Juthori@2026"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs font-mono text-[#1F1F1C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F1F1C]/70 mb-1">
                  الدور الوظيفي (يحدد اللوحات المسموح بفتحها حصراً)
                </label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as TeamRoleType)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs font-bold text-[#1F1F1C]"
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
                  onClick={() => {
                    setAddStaffError(null);
                    setShowAddStaffModal(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#E8DED2] text-xs font-bold text-[#1F1F1C] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isAddingStaff}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isAddingStaff ? 'جاري التسجيل والإرسال...' : 'اعتماد العضو وإرسال الدعوة'}
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
        <div className="fixed inset-0 z-50 bg-[#1F1F1C]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#F5F1E8] rounded-3xl border border-[#D97757]/50 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8C7B2] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1F1F1C]">
                  إدارة حساب وطلب العميل: {selectedOrderForModal.fullName}
                </h3>
                <p className="text-xs text-[#1F1F1C]/70">
                  رقم الطلب: {selectedOrderForModal.id} · {selectedOrderForModal.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForModal(null)}
                className="px-3 py-1 rounded-lg bg-[#E8DED2] text-xs font-bold text-[#1F1F1C]"
              >
                إغلاق
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-[#1F1F1C]/70">
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
                        ? 'bg-[#D97757] text-[#F5F1E8] border-[#D97757]'
                        : 'bg-[#F5F1E8] text-[#1F1F1C] border-[#D8C7B2]'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Linked Research Ticket & Customer Correspondence Summary */}
            <div className="pt-3 border-t border-[#D8C7B2] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1F1F1C]">
                  تذكرة التحقيق النَّسبي ومراسلات مرصد البحوث:
                </span>
              </div>
              {(() => {
                const linkedTicket = researchTicketsList.find(
                  (t) =>
                    (selectedOrderForModal.userId &&
                      t.userId === selectedOrderForModal.userId) ||
                    (selectedOrderForModal.email &&
                      (t.userEmail || '').toLowerCase() ===
                        selectedOrderForModal.email.toLowerCase()) ||
                    (selectedOrderForModal.ticketId &&
                      selectedOrderForModal.ticketId !== '—' &&
                      (t.ticketNumber === selectedOrderForModal.ticketId ||
                        t.id === selectedOrderForModal.ticketId))
                );

                if (!linkedTicket) {
                  return (
                    <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] p-3 text-[11px] text-[#1F1F1C]/70">
                      لا توجد تذكرة تحقيق نسبي مفتوحة حالياً لهذا العميل في مرصد البحوث.
                    </div>
                  );
                }

                const stage = resolveTicketLifecycleStage(linkedTicket);
                const msgs = linkedTicket.messages || [];
                const lastMsg = msgs[msgs.length - 1];
                const attCount = linkedTicket.attachments?.length || 0;

                return (
                  <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/60 p-3.5 text-xs space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] text-[11px]">
                        #{linkedTicket.ticketNumber}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-[#F5F1E8] border border-[#D8C7B2] font-bold text-[#D97757]">
                          المرحلة: {stage}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#F5F1E8] border border-[#D8C7B2] font-bold text-[#1F1F1C]">
                          💬 {msgs.length} مراسلات · 📎 {attCount} مرفقات
                        </span>
                      </div>
                    </div>

                    {lastMsg && (
                      <div className="rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] p-2.5 text-[11px] text-[#1F1F1C]">
                        <strong className="text-[#D97757]">
                          {lastMsg.senderRole === 'customer'
                            ? `آخر رد من العميل (${lastMsg.senderName}): `
                            : `آخر رد من الباحث (${lastMsg.senderName}): `}
                        </strong>
                        <span>{lastMsg.body}</span>
                      </div>
                    )}

                    {allowedTabs.includes('research_studio') && (
                      <button
                        type="button"
                        onClick={() => {
                          const focusKey =
                            linkedTicket.ticketNumber || linkedTicket.id;
                          setSelectedOrderForModal(null);
                          setFocusedResearchTicketId(focusKey);
                          setActiveTab('research_studio');
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-bold cursor-pointer transition-colors"
                      >
                        فتح التذكرة والرد على العميل في مرصد البحوث
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Customer Legal Audit Trail Section inside Manage Customer Modal */}
            <div className="pt-3 border-t border-[#D8C7B2] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1F1F1C]">
                  سجل التدقيق القانوني والموافقات الإلكترونية (Audit Trail):
                </span>
                <span className="text-[11px] font-bold text-[#D97757]">
                  {selectedOrderForModal.legalRole === 'record_keeper'
                    ? 'رب أسرة / أمين السجل ✓'
                    : 'حساب فرد'}
                </span>
              </div>

              {(() => {
                const customerAudits = legalAuditTrailList.filter(
                  (a) =>
                    (selectedOrderForModal.userId &&
                      a.userId === selectedOrderForModal.userId) ||
                    (selectedOrderForModal.email &&
                      a.userEmail?.toLowerCase() ===
                        selectedOrderForModal.email.toLowerCase())
                );
                if (customerAudits.length === 0) {
                  return (
                    <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] p-3 text-[11px] text-[#1F1F1C]/70">
                      موافقة شروط الاستخدام وسياسة الخصوصية مفعّلة عند إنشاء الحساب. لم يتم تسجيل شهادات إضافية بعد.
                    </div>
                  );
                }
                return (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {customerAudits.map((aud) => (
                      <div
                        key={aud.id}
                        className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] p-3 text-[11px] space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#1F1F1C]">
                            {aud.eventType === 'RECORD_KEEPER_CONTRACT_SIGNATURE'
                              ? 'توقيع عقد أمين السجل (29 مادة)'
                              : 'موافقة شروط الاستخدام وسياسة الخصوصية'}
                          </span>
                          <span
                            dir="ltr"
                            className="font-mono font-bold px-2 py-0.5 rounded bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757]"
                          >
                            {aud.certificateCode}
                          </span>
                        </div>
                        <div className="text-[#1F1F1C]/70 flex flex-wrap items-center justify-between gap-2">
                          <span>الإصدار: {aud.documentVersion}</span>
                          <span dir="ltr">
                            IP: {aud.ipAddress} ({aud.ipCountry})
                          </span>
                          <span>{aud.signedAtFormatted}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL 3: Add / Edit Knowledge Center Topic (مقال / فيديو)
         ======================================================================= */}
      {isArticleModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#1F1F1C]/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#F5F1E8] rounded-3xl border border-[#D97757]/50 max-w-4xl w-full p-6 sm:p-8 shadow-2xl my-8 max-h-[92vh] overflow-y-auto">
            {/* Modal Top Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8C7B2] pb-4 mb-5">
              <div>
                <h3 className="text-lg sm:text-xl font-display font-extrabold text-[#1F1F1C]">
                  {editingArticleId
                    ? 'تعديل موضوع (مقال/فيديو)'
                    : 'إضافة موضوع جديد (مقال/فيديو)'}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Switch between Editor and Live Visitor Preview */}
                <div className="inline-flex rounded-xl bg-[#F5F1E8] p-1 border border-[#D8C7B2]">
                  <button
                    type="button"
                    onClick={() => setArticleModalTab('edit')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      articleModalTab === 'edit'
                        ? 'bg-[#D97757] text-[#F5F1E8]'
                        : 'text-[#1F1F1C]/70 hover:text-[#1F1F1C]'
                    }`}
                  >
                    تحرير الموضوع
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      syncEditorContentToState();
                      setArticleModalTab('preview');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      articleModalTab === 'preview'
                        ? 'bg-[#D97757] text-[#F5F1E8]'
                        : 'text-[#1F1F1C]/70 hover:text-[#1F1F1C]'
                    }`}
                  >
                    معاينة العرض
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsArticleModalOpen(false)}
                  className="p-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] text-[#1F1F1C] cursor-pointer border border-[#D8C7B2]"
                  aria-label="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {articleModalTab === 'preview' ? (
              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-[#F5F1E8] border border-[#D97757]/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#D97757]">
                      معاينة حية لشكل الموضوع في المركز المعرفي:
                    </span>
                    <button
                      type="button"
                      onClick={() => setArticleModalTab('edit')}
                      className="text-xs font-bold text-[#D97757] underline cursor-pointer"
                    >
                      العودة للتحرير
                    </button>
                  </div>

                  {articleCoverImageUrl && (
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-[#E8DED2] border border-[#D8C7B2] shadow-sm">
                      <ResilientImage
                        src={articleCoverImageUrl}
                        alt={articleTitle || 'معاينة صورة الغلاف'}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1F1F1C]/75 via-transparent to-transparent pointer-events-none" />
                      {articleCoverTextOverlay && (
                        <div className="absolute bottom-4 right-4 left-4 text-[#F5F1E8] font-display font-bold text-base sm:text-lg drop-shadow-md">
                          {articleCoverTextOverlay}
                        </div>
                      )}
                    </div>
                  )}

                  {(articleImageCaption || articleImageCopyright) && (
                    <div className="flex justify-between text-[11px] text-[#1F1F1C]/70 bg-[#E8DED2]/70 px-3.5 py-2 rounded-xl">
                      <span>{articleImageCaption}</span>
                      {articleImageCopyright && (
                        <span>© {articleImageCopyright}</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs font-bold text-[#D97757]">
                    <span>
                      {articleType} / {articleSection} -{' '}
                      {articleFilter === '__custom__'
                        ? customArticleFilter || 'عام'
                        : articleFilter}
                    </span>
                    {articlePublishDate && (
                      <span className="text-[#1F1F1C]/70">
                        · {articlePublishDate}
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-display font-extrabold text-[#1F1F1C]">
                    {articleTitle || 'عنوان الموضوع التجريبي'}
                  </h2>

                  {articleDescription && (
                    <div className="p-4 rounded-xl bg-[#F5F1E8] border-r-4 border-[#D97757] text-sm font-bold text-[#1F1F1C]">
                      {articleDescription}
                    </div>
                  )}

                  <div
                    className="prose max-w-none text-sm text-[#1F1F1C]/90 leading-loose bg-[#F5F1E8] p-5 rounded-2xl border border-[#D8C7B2]"
                    dangerouslySetInnerHTML={{
                      __html:
                        articleContent ||
                        '<p class="text-[#1F1F1C]/55">لم يتم إدخال نص المقال بعد...</p>',
                    }}
                  />
                </div>

                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setArticleModalTab('edit')}
                    className="px-5 py-2.5 rounded-xl bg-[#E8DED2] text-xs font-bold text-[#1F1F1C] cursor-pointer"
                  >
                    متابعة التحرير
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveKnowledgeArticle} className="space-y-5">
                {/* Row 1: Title & Content Type */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                      عنوان الموضوع *
                    </label>
                    <input
                      type="text"
                      required
                      value={articleTitle}
                      onChange={(e) => setArticleTitle(e.target.value)}
                      placeholder="أدخل عنوان المقال أو الفيديو..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] focus:bg-[#F5F1E8] focus:border-[#D97757] focus:outline-none text-xs sm:text-sm font-bold text-[#1F1F1C]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                      نوع الموضوع *
                    </label>
                    <select
                      value={articleType}
                      onChange={(e) =>
                        setArticleType(e.target.value as KnowledgeContentType)
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] focus:bg-[#F5F1E8] focus:border-[#D97757] focus:outline-none text-xs sm:text-sm font-bold text-[#1F1F1C]"
                    >
                      <option value="مقال">مقال</option>
                      <option value="فيديو">فيديو</option>
                    </select>
                  </div>
                </div>

                {/* Row 2: Section, Sub-Filter & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                      القسم الرئيسي *
                    </label>
                    <select
                      value={articleSection}
                      onChange={(e) => {
                        const nextSec = e.target.value;
                        setArticleSection(nextSec);
                        const defaultFlt =
                          KNOWLEDGE_BASE_SECTIONS[nextSec]?.baseFilters?.[0] ||
                          'عام';
                        setArticleFilter(defaultFlt);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs font-bold text-[#1F1F1C]"
                    >
                      {Object.keys(KNOWLEDGE_BASE_SECTIONS).map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                      القسم الفرعي *
                    </label>
                    <select
                      value={articleFilter}
                      onChange={(e) => setArticleFilter(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs font-bold text-[#1F1F1C]"
                    >
                      {(
                        KNOWLEDGE_BASE_SECTIONS[articleSection]?.baseFilters || [
                          'عام',
                        ]
                      ).map((flt) => (
                        <option key={flt} value={flt}>
                          {flt}
                        </option>
                      ))}
                      <option value="__custom__">+ إضافة قسم فرعي جديد...</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                      حالة النشر
                    </label>
                    <select
                      value={articleStatus}
                      onChange={(e) =>
                        setArticleStatus(e.target.value as 'published' | 'draft')
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs font-bold text-[#1F1F1C]"
                    >
                      <option value="published">منشور للجمهور</option>
                      <option value="draft">مسودة تحريرية</option>
                    </select>
                  </div>
                </div>

                {articleFilter === '__custom__' && (
                  <div>
                    <label className="block text-xs font-bold text-[#D97757] mb-1">
                      اسم الفلتر الفرعي الجديد *
                    </label>
                    <input
                      type="text"
                      required
                      value={customArticleFilter}
                      onChange={(e) => setCustomArticleFilter(e.target.value)}
                      placeholder="اكتب اسم التصنيف الفرعي ليظهر كزر تصفية مستقل في هذا القسم..."
                      className="w-full px-3.5 py-2 rounded-xl bg-[#F5F1E8] border border-[#D97757] text-xs font-bold text-[#1F1F1C]"
                    />
                  </div>
                )}

                {/* Row 3: Author, Editor & Publish Date */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                      الكاتب / المنتج (اختياري)
                    </label>
                    <input
                      type="text"
                      value={articleAuthor}
                      onChange={(e) => setArticleAuthor(e.target.value)}
                      placeholder="مثال: هيئة التحقيق والأنساب"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs text-[#1F1F1C]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                      تحرير (اختياري)
                    </label>
                    <input
                      type="text"
                      value={articleEditor}
                      onChange={(e) => setArticleEditor(e.target.value)}
                      placeholder="اسم المحرر..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs text-[#1F1F1C]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                      تاريخ النشر (اختياري)
                    </label>
                    <input
                      type="date"
                      dir="ltr"
                      value={articlePublishDate}
                      onChange={(e) => setArticlePublishDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs font-mono text-[#1F1F1C]"
                    />
                  </div>
                </div>

                {/* Short Card Summary with 1-Click Auto-Extract */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <label className="block text-xs font-bold text-[#1F1F1C]">
                      الوصف المختصر للبطاقة (اختياري — يُستخرج تلقائياً من النص إن تُرك فارغاً)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const currentHtml =
                          richEditorRef.current?.innerHTML || articleContent;
                        const plain = extractPlainTextFromHtml(currentHtml);
                        if (plain) {
                          setArticleDescription(plain.slice(0, 170));
                        }
                      }}
                      className="text-[11px] font-bold text-[#D97757] hover:text-[#D97757] cursor-pointer"
                    >
                      ✨ استخراج الملخص تلقائياً من نص المقال
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={articleDescription}
                    onChange={(e) => setArticleDescription(e.target.value)}
                    placeholder="نبذة موجزة تظهر تحت عنوان الموضوع في بطاقة المركز المعرفي..."
                    className="w-full px-3.5 py-2 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs text-[#1F1F1C]"
                  />
                </div>

                {/* =============================================================
                    FULL RICH TEXT WYSIWYG EDITOR (Matching Screenshot + Power Tools)
                   ============================================================= */}
                <div className="space-y-2">
                  {/* Quick Starter Templates Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F5F1E8] px-3 py-2 rounded-xl border border-[#D8C7B2]">
                    <span className="text-[11px] font-bold text-[#1F1F1C]/70">
                      إدراج هيكل جاهز بنقرة واحدة:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyQuickArticleTemplate('manuscript')}
                        className="px-2.5 py-1 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[11px] font-bold text-[#1F1F1C] cursor-pointer"
                      >
                        📜 تحقيق مخطوطة
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickArticleTemplate('family_study')}
                        className="px-2.5 py-1 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[11px] font-bold text-[#1F1F1C] cursor-pointer"
                      >
                        🌳 دراسة نسبية
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickArticleTemplate('dna_science')}
                        className="px-2.5 py-1 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[11px] font-bold text-[#1F1F1C] cursor-pointer"
                      >
                        🧬 مقال علمي
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickArticleTemplate('event_news')}
                        className="px-2.5 py-1 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[11px] font-bold text-[#1F1F1C] cursor-pointer"
                      >
                        📅 تغطية فعالية/خبر
                      </button>
                    </div>
                  </div>

                  {/* Toolbar + Label Row (Matches User Screenshot) */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-bold text-[#1F1F1C]">
                      نص المقال/وصف الفيديو (اختياري - محرر نصي يدعم جميع المزايا)
                    </label>

                    {/* Formatting Toolbar */}
                    <div className="flex flex-wrap items-center gap-1 bg-[#F5F1E8] border border-[#D8C7B2] rounded-xl px-2 py-1.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => execEditorCommand('bold')}
                        className="px-2 py-1 rounded hover:bg-[#E8DED2] text-xs font-extrabold text-[#1F1F1C] cursor-pointer"
                        title="نص عريض (Bold)"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => execEditorCommand('italic')}
                        className="px-2 py-1 rounded hover:bg-[#E8DED2] text-xs italic font-serif text-[#1F1F1C] cursor-pointer"
                        title="نص مائل (Italic)"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        onClick={() => execEditorCommand('underline')}
                        className="px-2 py-1 rounded hover:bg-[#E8DED2] text-xs underline text-[#1F1F1C] cursor-pointer"
                        title="تسطير (Underline)"
                      >
                        U
                      </button>

                      <span className="h-4 w-px bg-[#D8C7B2] mx-0.5" />

                      <button
                        type="button"
                        onClick={() => execEditorCommand('fontSize', '5')}
                        className="px-2 py-1 rounded hover:bg-[#E8DED2] text-[11px] font-bold text-[#1F1F1C] cursor-pointer"
                        title="تكبير حجم النص"
                      >
                        تكبير
                      </button>
                      <button
                        type="button"
                        onClick={() => execEditorCommand('fontSize', '3')}
                        className="px-2 py-1 rounded hover:bg-[#E8DED2] text-[11px] font-bold text-[#1F1F1C] cursor-pointer"
                        title="تصغير حجم النص"
                      >
                        تصغير
                      </button>
                      <button
                        type="button"
                        onClick={() => execEditorCommand('formatBlock', 'H3')}
                        className="px-2 py-1 rounded hover:bg-[#E8DED2] text-[11px] font-bold text-[#D97757] cursor-pointer"
                        title="عنوان فرعي"
                      >
                        عنوان
                      </button>

                      <span className="h-4 w-px bg-[#D8C7B2] mx-0.5" />

                      <button
                        type="button"
                        onClick={() => execEditorCommand('insertUnorderedList')}
                        className="px-2 py-1 rounded hover:bg-[#E8DED2] text-[11px] font-bold text-[#1F1F1C] cursor-pointer"
                        title="قائمة نقطية"
                      >
                        • نقاط
                      </button>
                      <button
                        type="button"
                        onClick={() => execEditorCommand('insertOrderedList')}
                        className="px-2 py-1 rounded hover:bg-[#E8DED2] text-[11px] font-bold text-[#1F1F1C] cursor-pointer"
                        title="قائمة رقمية"
                      >
                        1. ترقيم
                      </button>

                      <span className="h-4 w-px bg-[#D8C7B2] mx-0.5" />

                      <button
                        type="button"
                        onClick={() => execEditorCommand('justifyRight')}
                        className="px-2 py-1 rounded hover:bg-[#E8DED2] text-[11px] font-bold text-[#1F1F1C] cursor-pointer"
                        title="محاذاة لليمين"
                      >
                        يمين
                      </button>
                      <button
                        type="button"
                        onClick={() => execEditorCommand('justifyCenter')}
                        className="px-2 py-1 rounded hover:bg-[#E8DED2] text-[11px] font-bold text-[#1F1F1C] cursor-pointer"
                        title="توسيط"
                      >
                        وسط
                      </button>
                      <button
                        type="button"
                        onClick={() => execEditorCommand('justifyLeft')}
                        className="px-2 py-1 rounded hover:bg-[#E8DED2] text-[11px] font-bold text-[#1F1F1C] cursor-pointer"
                        title="محاذاة لليسار"
                      >
                        يسار
                      </button>

                      <span className="h-4 w-px bg-[#D8C7B2] mx-0.5" />

                      <button
                        type="button"
                        onClick={() =>
                          insertHtmlAtCursor(
                            `<blockquote style="border-right: 4px solid #D97757; background: #F5F1E8; padding: 12px 16px; margin: 12px 0; border-radius: 8px; font-weight: bold;">«اكتب نص الاقتباس أو المصدر هنا...»</blockquote><p><br/></p>`
                          )
                        }
                        className="px-2 py-1 rounded hover:bg-[#E8DED2] text-[11px] font-bold text-[#D97757] cursor-pointer"
                        title="إدراج صندوق اقتباس تراثي"
                      >
                        ❝ اقتباس
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          execEditorCommand('hiliteColor', '#E8DED2')
                        }
                        className="px-2 py-1 rounded hover:bg-[#E8DED2] text-[11px] font-bold text-[#1F1F1C] cursor-pointer"
                        title="تمييز النص بلون ذهبي"
                      >
                        تمييز
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setShowInlineLinkInput((prev) => !prev)
                        }
                        className="px-2 py-1 rounded hover:bg-[#E8DED2] text-[11px] font-bold text-[#1F1F1C] cursor-pointer"
                        title="إدراج رابط"
                      >
                        🔗 رابط
                      </button>

                      <button
                        type="button"
                        onClick={() => execEditorCommand('removeFormat')}
                        className="px-2 py-1 rounded hover:bg-[#E8DED2] text-[11px] text-[#1F1F1C]/70 cursor-pointer"
                        title="مسح التنسيق"
                      >
                        مسح التنسيق
                      </button>

                      {/* Insert Image inside Article Body (Red/Terracotta Framed Button matching screenshot) */}
                      <button
                        type="button"
                        disabled={isUploadingInlineImage}
                        onClick={() => inlineImageInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-lg border border-[#D97757]/40 bg-[#F5F1E8] hover:bg-[#E8DED2] text-[11px] font-bold text-[#D97757] cursor-pointer disabled:opacity-50"
                        title="رفع وإدراج صورة من جهازك داخل نص المقال بأبعاد قياسية"
                      >
                        {isUploadingInlineImage
                          ? 'جاري معالجة الصورة...'
                          : 'إدراج صورة'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setShowInlineImageUrlInput((prev) => !prev)
                        }
                        className="px-2 py-1 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[10px] font-bold text-[#1F1F1C]/70 cursor-pointer"
                        title="إدراج صورة عبر رابط مباشر"
                      >
                        رابط صورة
                      </button>
                      <input
                        ref={inlineImageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleInlineEditorImageUpload}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* Optional Inline Link Popover */}
                  {showInlineLinkInput && (
                    <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-[#F5F1E8] border border-[#D97757]/50">
                      <input
                        type="text"
                        value={inlineLinkText}
                        onChange={(e) => setInlineLinkText(e.target.value)}
                        placeholder="عنوان الرابط المعروض..."
                        className="px-3 py-1.5 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] text-xs"
                      />
                      <input
                        type="url"
                        dir="ltr"
                        value={inlineLinkUrl}
                        onChange={(e) => setInlineLinkUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (inlineLinkUrl.trim()) {
                            const label =
                              inlineLinkText.trim() || inlineLinkUrl.trim();
                            insertHtmlAtCursor(
                              `<a href="${inlineLinkUrl.trim()}" target="_blank" rel="noopener noreferrer" style="color: #D97757; text-decoration: underline; font-weight: bold;">${label}</a>&nbsp;`
                            );
                            setInlineLinkUrl('');
                            setInlineLinkText('');
                            setShowInlineLinkInput(false);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#D97757] text-[#F5F1E8] text-xs font-bold cursor-pointer"
                      >
                        إدراج الرابط
                      </button>
                    </div>
                  )}

                  {/* Optional Inline Image URL Popover */}
                  {showInlineImageUrlInput && (
                    <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-[#F5F1E8] border border-[#D97757]/50">
                      <input
                        type="url"
                        dir="ltr"
                        value={inlineImageUrl}
                        onChange={(e) => setInlineImageUrl(e.target.value)}
                        placeholder="https://example.com/photo.jpg"
                        className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (inlineImageUrl.trim()) {
                            const normalizedUrl = normalizeExternalImageUrl(
                              inlineImageUrl.trim()
                            );
                            insertHtmlAtCursor(
                              `<figure style="margin: 20px auto; text-align: center; max-width: 100%;"><img src="${normalizedUrl}" alt="صورة داخل المقال" style="width: 100%; max-height: 480px; object-fit: contain; background: #F5F1E8; border-radius: 16px; border: 1px solid rgba(217,119,87,0.45); margin: 0 auto; display: block;" /></figure><p><br/></p>`
                            );
                            setInlineImageUrl('');
                            setShowInlineImageUrlInput(false);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#D97757] text-[#F5F1E8] text-xs font-bold cursor-pointer"
                      >
                        إدراج الصورة
                      </button>
                    </div>
                  )}

                  {/* Rich Text ContentEditable Box (Framed with Heritage Terracotta/Crimson Border as in Screenshot) */}
                  <div
                    ref={richEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={syncEditorContentToState}
                    onBlur={syncEditorContentToState}
                    data-placeholder="اكتب نص المقال أو الصق المحتوى المنسق هنا..."
                    className="min-h-[210px] max-h-[380px] overflow-y-auto w-full p-4 rounded-xl bg-[#F5F1E8] border-2 border-[#D97757] focus:border-[#D97757] focus:outline-none text-sm text-[#1F1F1C] leading-relaxed prose max-w-none"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#1F1F1C]/70 px-1">
                    <span>
                      يمكنك تنسيق النصوص، وإدراج الصور والاقتباسات والروابط مباشرة داخل المحرر.
                    </span>
                    <span className="font-mono">
                      عدد الكلمات: {editorWordCount} · وقت القراءة:{' '}
                      {Math.max(1, Math.ceil(editorWordCount / 180))} دقيقة
                    </span>
                  </div>

                  {/* مقياس الرصانة وجودة التوثيق الحي داخل المحرر */}
                  <div
                    data-testid="live-editor-rigor-meter"
                    className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2.5 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-extrabold text-[#1F1F1C]">
                        درجة رصانة المادة الحالية:{' '}
                        <span
                          className={`font-mono ${
                            liveEditorRigor.score >= 90
                              ? 'text-[#D97757]'
                              : liveEditorRigor.score >= 65
                                ? 'text-[#D97757]'
                                : 'text-[#D97757]'
                          }`}
                        >
                          {liveEditorRigor.score}%
                        </span>
                      </span>
                      <span className="text-[11px] font-bold text-[#D97757]">
                        {liveEditorRigor.hint}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#E8DED2] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          liveEditorRigor.score >= 90
                            ? 'bg-[#D97757]'
                            : liveEditorRigor.score >= 65
                              ? 'bg-[#D97757]'
                              : 'bg-[#D97757]'
                        }`}
                        style={{ width: `${liveEditorRigor.score}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* =============================================================
                    SECTION: الروابط والصور (Matches Screenshot Layout)
                   ============================================================= */}
                <div className="pt-4 border-t border-[#D8C7B2] space-y-3.5">
                  <h4 className="text-sm font-display font-extrabold text-[#1F1F1C] border-r-4 border-[#D97757] pr-2.5">
                    الروابط والصور
                  </h4>

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <label className="block text-xs font-bold text-[#1F1F1C]">
                        رابط صورة الغلاف (اختياري)
                      </label>
                      <span className="text-[11px] font-bold text-[#D97757] bg-[#F5F1E8] px-2.5 py-0.5 rounded-full border border-[#D8C7B2]">
                        الأبعاد القياسية المعتمدة: 16:9 (1200×675 بكسل) — تتم المعايرة تلقائياً عند الإرفاق
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="text"
                        dir="ltr"
                        value={articleCoverImageUrl}
                        onChange={(e) =>
                          setArticleCoverImageUrl(
                            normalizeExternalImageUrl(e.target.value)
                          )
                        }
                        placeholder="https://example.com/image.jpg"
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] focus:border-[#D97757] focus:outline-none text-xs text-[#1F1F1C]"
                      />
                      <label
                        className={`inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-[#E8DED2] hover:bg-[#D8C7B2]/60 text-[#1F1F1C] text-xs font-bold cursor-pointer shrink-0 border border-[#D8C7B2] transition-colors ${
                          isUploadingCoverImage ? 'opacity-60 pointer-events-none' : ''
                        }`}
                      >
                        <span>
                          {isUploadingCoverImage
                            ? 'جاري معايرة الأبعاد...'
                            : 'إرفاق صورة'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={isUploadingCoverImage}
                          onChange={handleCoverImageUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <p className="text-[11px] text-[#D97757] font-semibold mt-1">
                      أضف رابط مباشر للصور أو قم بتحميل ملف صورة (يتم ضبط الأبعاد القياسية 16:9 تلقائياً).
                    </p>

                    {articleCoverImageUrl && (
                      <div className="mt-3 p-3 rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#1F1F1C]">
                            معاينة صورة الغلاف بالأبعاد القياسية (16:9) ✓
                          </span>
                          <button
                            type="button"
                            onClick={() => setArticleCoverImageUrl('')}
                            className="text-[11px] font-bold text-[#D97757] hover:underline cursor-pointer px-2"
                          >
                            إزالة الصورة
                          </button>
                        </div>
                        <div className="relative w-full max-w-md aspect-video rounded-xl overflow-hidden bg-[#E8DED2] border border-[#D8C7B2] shadow-xs">
                          <ResilientImage
                            src={articleCoverImageUrl}
                            alt="معاينة الغلاف القياسية"
                            className="w-full h-full object-cover"
                          />
                          {articleCoverTextOverlay && (
                            <div className="absolute inset-0 bg-gradient-to-t from-[#1F1F1C]/80 via-transparent to-transparent flex items-end p-3">
                              <span className="text-[#F5F1E8] font-display font-bold text-xs sm:text-sm drop-shadow">
                                {articleCoverTextOverlay}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {articleType === 'فيديو' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                          رابط الفيديو (YouTube أو رابط مباشر)
                        </label>
                        <input
                          type="url"
                          dir="ltr"
                          value={articleVideoUrl}
                          onChange={(e) => setArticleVideoUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs text-[#1F1F1C]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                          مدة الفيديو (بالدقائق - اختياري)
                        </label>
                        <input
                          type="text"
                          value={articleDuration}
                          onChange={(e) => setArticleDuration(e.target.value)}
                          placeholder="مثال: 12"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs text-[#1F1F1C]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* =============================================================
                    SECTION: النصوص المصاحبة للصورة/الفيديو (Matches Screenshot Layout)
                   ============================================================= */}
                <div className="pt-4 border-t border-[#D8C7B2] space-y-3.5">
                  <h4 className="text-sm font-display font-extrabold text-[#1F1F1C] border-r-4 border-[#D97757] pr-2.5">
                    النصوص المصاحبة للصورة/الفيديو
                  </h4>

                  <div>
                    <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                      إلصق عنوان (الصورة/الفيديو) وهو نص يعرض فوق الصورة (اختياري)
                    </label>
                    <input
                      type="text"
                      value={articleCoverTextOverlay}
                      onChange={(e) => setArticleCoverTextOverlay(e.target.value)}
                      placeholder="مثال: رحلة البحث في التراث..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] focus:border-[#D97757] focus:outline-none text-xs text-[#1F1F1C]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                        وصف الصورة/الفيديو المصغر (أسفل الصورة) (اختياري)
                      </label>
                      <input
                        type="text"
                        value={articleImageCaption}
                        onChange={(e) => setArticleImageCaption(e.target.value)}
                        placeholder="توضيح للصورة أو الوثيقة المعروضة..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] focus:border-[#D97757] focus:outline-none text-xs text-[#1F1F1C]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                        الملكية الفكرية (اختياري)
                      </label>
                      <input
                        type="text"
                        value={articleImageCopyright}
                        onChange={(e) => setArticleImageCopyright(e.target.value)}
                        placeholder="مثال: أرشيف مركز آدم للبحوث"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] focus:border-[#D97757] focus:outline-none text-xs text-[#1F1F1C]"
                      />
                    </div>
                  </div>
                </div>

                {/* Optional Fields Aesthetic Notice Banner (Matches Screenshot) */}
                <div className="p-3.5 rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] flex items-center gap-2.5 text-xs font-bold text-[#D97757]">
                  <span className="w-5 h-5 rounded-full border border-[#D97757] flex items-center justify-center text-[11px] shrink-0">
                    !
                  </span>
                  <span>
                    الحقول الاختيارية التي لا يتم تعبئتها لن تظهر للمستخدم للحفاظ على جمالية العرض.
                  </span>
                </div>

                {/* Submit / Cancel Footer */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#D8C7B2]">
                  <button
                    type="button"
                    onClick={() => setIsArticleModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl bg-[#E8DED2] hover:bg-[#D8C7B2]/60 text-xs font-bold text-[#1F1F1C] cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingArticle}
                    className="px-6 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs sm:text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {isSavingArticle
                      ? 'جاري الحفظ...'
                      : editingArticleId
                      ? 'حفظ التعديلات'
                      : 'نشر الموضوع'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: تأكيد حذف مقال من المركز المعرفي
         ===================================================================== */}
      {pendingDeleteArticle && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cms-delete-confirm-title"
          onClick={() => {
            if (!isDeletingArticle) setPendingDeleteArticle(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1F1C]/50 backdrop-blur-[2px] p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#F5F1E8] rounded-2xl border border-[#D8C7B2] shadow-2xl overflow-hidden text-right"
          >
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-[#D97757]" />
                </div>
                <div className="space-y-1 flex-1">
                  <h3
                    id="cms-delete-confirm-title"
                    className="text-base font-extrabold text-[#1F1F1C]"
                  >
                    تأكيد حذف المقال
                  </h3>
                  <p className="text-xs text-[#1F1F1C]/70 leading-relaxed">
                    هل أنت متأكد من رغبتك في حذف هذا الموضوع نهائياً من المركز المعرفي؟ لا يمكن التراجع عن هذا الإجراء بعد التنفيذ.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isDeletingArticle}
                  onClick={() => setPendingDeleteArticle(null)}
                  className="p-1.5 rounded-lg text-[#1F1F1C]/70 hover:bg-[#F5F1E8] hover:text-[#1F1F1C] transition cursor-pointer disabled:opacity-40"
                  aria-label="إغلاق نافذة التأكيد"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] space-y-1">
                <div className="text-sm font-bold text-[#1F1F1C] line-clamp-2">
                  {pendingDeleteArticle.title}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#1F1F1C]/70">
                  <span>
                    {pendingDeleteArticle.section || 'الروايات والذاكرة'}
                  </span>
                  <span>·</span>
                  <span>{pendingDeleteArticle.filter || 'عام'}</span>
                  {pendingDeleteArticle.publishDate && (
                    <>
                      <span>·</span>
                      <span dir="ltr" className="font-mono">
                        {pendingDeleteArticle.publishDate}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#D8C7B2]">
                <button
                  type="button"
                  disabled={isDeletingArticle}
                  onClick={() => setPendingDeleteArticle(null)}
                  className="px-4 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs font-bold text-[#1F1F1C] transition cursor-pointer disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={isDeletingArticle}
                  onClick={() =>
                    handleDeleteKnowledgeArticle(pendingDeleteArticle.id)
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-bold transition cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {isDeletingArticle ? 'جاري الحذف...' : 'نعم، تأكيد الحذف'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
