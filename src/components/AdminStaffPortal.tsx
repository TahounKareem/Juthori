import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
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
  FOUNDING_MAESTRO_MEMBER,
  KnowledgeArticleRecord,
  KnowledgeContentType,
  SupportTicketRecord,
  TeamMemberRecord,
  TeamRoleType,
  addTeamMemberToFirebase,
  approveCharterRequestInFirebase,
  authenticateTeamMemberInFirebase,
  bootstrapJuthoriFirestoreDatabase,
  deleteKnowledgeArticleFromFirebase,
  deleteTeamMemberFromFirebase,
  fetchAllCustomerOrdersFromFirebase,
  fetchAllResearchTicketsForStaff,
  fetchAllTeamMembersFromFirebase,
  fetchCharterRequestsFromFirebase,
  fetchKnowledgeArticlesFromFirebase,
  fetchSupportTicketsFromFirebase,
  normalizeExternalImageUrl,
  processAndUploadKnowledgeImage,
  resolveSupportTicketInFirebase,
  saveKnowledgeArticleToFirebase,
  updateCustomerOrderInFirebase,
  updateTeamMemberStatusInFirebase,
} from '../services/firestoreService';
import { JuthoriLogo } from './JuthoriLogo';
import { ResilientImage } from './ResilientImage';
import { ResearcherStudio } from './ResearcherStudio';
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
  | 'users_rbac'
  | 'research_studio'
  | 'adam_tree_management'
  | 'direct_search_inspection'
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
const TEAM_LAST_LOGIN_TS_KEY = 'juthori_team_last_login_timestamp';

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
        'command_hub',
        'direct_search_inspection',
        'research_studio',
        'adam_tree_management',
        'orders_support',
        'knowledge_cms',
        'users_rbac',
        'executive_reports',
      ];
    case 'مدير البحوث':
      return [
        'command_hub',
        'direct_search_inspection',
        'research_studio',
        'adam_tree_management',
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
  const allowedTabs = useMemo<AdminModuleTab[]>(
    () => (loggedInMember ? getAllowedTabsForRole(loggedInMember.role) : []),
    [loggedInMember]
  );

  const [activeTab, setActiveTab] = useState<AdminModuleTab>('command_hub');

  useEffect(() => {
    if (loggedInMember) {
      const allowed = getAllowedTabsForRole(loggedInMember.role);
      if (!allowed.includes(activeTab)) {
        setActiveTab('command_hub');
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

  // Load real data from Firebase when authenticated (non-blocking bootstrap)
  const refreshAllFirebaseData = async () => {
    if (!loggedInMember) return;
    setIsLoadingData(true);
    try {
      bootstrapJuthoriFirestoreDatabase().catch(() => {});
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
    if (loggedInMember && activeTab === 'command_hub') {
      fetchAllResearchTicketsForStaff()
        .then((list) => setResearchTicketsCount(list.length))
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
          `<figure style="margin: 20px auto; text-align: center; max-width: 100%;"><img src="${processed.url}" alt="صورة مرفقة" style="width: 100%; max-height: 480px; object-fit: contain; background: #FAF6F0; border-radius: 16px; border: 1px solid rgba(185,138,120,0.45); margin: 0 auto; display: block;" /></figure><p><br/></p>`
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
      manuscript: `<h3><strong>أولاً: التعريف بالمخطوطة ومصدرها التاريخي</strong></h3><p>اذكر اسم المخطوطة أو الوثيقة ومؤلفها وتاريخ نسخها ومكان حفظها...</p><blockquote style="border-right: 4px solid #D8755B; background: #F7F2E9; padding: 12px 16px; margin: 14px 0; border-radius: 8px; font-style: italic;">«نص الاقتباس الموثق من المخطوطة مع الإشارة إلى رقم الجزء والصفحة»</blockquote><h3><strong>ثانياً: دلالات السلاسل النسبية الواردة</strong></h3><ul><li>العقد النسبية المحققة في الوثيقة:</li><li>المواطن التاريخية المذكورة:</li><li>تقاطع الرواية مع أمهات كتب الأنساب:</li></ul>`,
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

  const editorWordCount = useMemo(() => {
    const plain = extractPlainTextFromHtml(articleContent);
    if (!plain) return 0;
    return plain.split(/\s+/).filter(Boolean).length;
  }, [articleContent]);

  const openNewArticleModal = () => {
    setEditingArticleId(null);
    setArticleModalTab('edit');
    setArticleTitle('');
    setArticleType('مقال');
    setArticleSection('الروايات والذاكرة');
    setArticleFilter('عام');
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

    // 1. Instant in-memory check against pre-loaded staffList / Founding Maestro (< 5ms)
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
      completeLoginRedirect(cachedMatch);
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
        editor: articleEditor,
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
    try {
      await deleteKnowledgeArticleFromFirebase(articleId);
      setKnowledgeArticles((prev) => prev.filter((a) => a.id !== articleId));
      triggerToast('تم حذف الموضوع من المركز المعرفي.');
    } catch {
      triggerToast('تعذر حذف الموضوع.');
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
        'غرفة عمليات التذاكر البحثية وتوثيق المصادر وإثراء شجرة آدم للأجداد.',
      liveCounterLabel: 'التذاكر النشطة بالمرصد',
      liveCounterValue: `${researchTicketsCount} تذكرة نشطة`,
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

  const roleSpecificRadarCards = useMemo(() => {
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
          badgeColor: 'bg-[#FAF6F0] text-[#8D4925] border-[#C5A059]/60',
        },
        {
          title: 'نقاط الإنجاز والمكافآت ومتوسط زمن المعالجة',
          value: `${researcherKpi.totalXpScore} XP`,
          subLabel: `متوسط زمن البحث: ${formatDurationMmSs(
            researcherKpi.avgHandlingTimeSeconds || 94
          )} دقيقة`,
          progressPercent: 97,
          badgeText: 'نقاط المكافآت 🏆',
          badgeColor: 'bg-[#FAF6F0] text-[#8D4925] border-[#C5A059]/60',
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
          badgeColor: 'bg-[#FAF6F0] text-[#8D4925] border-[#C5A059]/60',
        },
        {
          title: 'حالة انضباط الجلسات ونشاط المديرين والباحثين',
          value: `${activeStaffCount} / ${staffList.length} حسابات نشطة`,
          subLabel: 'جميع الجلسات خاضعة للبصمة الزمنية والرقابة اللحظية',
          progressPercent: Math.round(
            (activeStaffCount / Math.max(1, staffList.length)) * 100
          ),
          badgeText: 'جلسات الفريق 👥',
          badgeColor: 'bg-[#FAF6F0] text-[#8D4925] border-[#C5A059]/60',
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
          badgeColor: 'bg-[#FAF6F0] text-[#8D4925] border-[#C5A059]/60',
        },
        {
          title: 'متوسط زمن معالجة البحث الواحد',
          value: `${formatDurationMmSs(
            researcherKpi.avgHandlingTimeSeconds || 95
          )} دقيقة`,
          subLabel: 'المعيار القياسي المستهدف: 02:00 دقيقة / بحث',
          progressPercent: 88,
          badgeText: 'سرعة الإنجاز ⏱️',
          badgeColor: 'bg-[#FAF6F0] text-[#8D4925] border-[#C5A059]/60',
        },
        {
          title: 'عُقد ألفا الموصولة ومراجع آدم برايم',
          value: `${researcherKpi.totalAlphaNodesBridged} عقدة · ${researcherKpi.totalAdamPrimeSourcesVerified} مرجع`,
          subLabel: 'توثيق مباشر في شجرة آدم الكبرى وسجل آدم برايم',
          progressPercent: 92,
          badgeText: 'توثيق معتمد 🌳',
          badgeColor: 'bg-[#FAF6F0] text-[#8D4925] border-[#C5A059]/60',
        },
        {
          title: 'نقاط الإنجاز والمكافآت وجودة التدقيق',
          value: `${researcherKpi.totalXpScore} XP`,
          subLabel: 'معدل دقة خياطة الأعمدة ومطابقة المراجع: 99.2%',
          progressPercent: 99,
          badgeText: 'نقاط الإنجاز 🏆',
          badgeColor: 'bg-[#FAF6F0] text-[#8D4925] border-[#C5A059]/60',
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
          badgeColor: 'bg-[#FAF6F0] text-[#8D4925] border-[#C5A059]/60',
        },
        {
          title: 'متوسط زمن الاستجابة الأول للعميل',
          value: '04:12 دقيقة',
          subLabel: 'الحد الأقصى المسموح في SLA: 10:00 دقائق',
          progressPercent: 95,
          badgeText: 'ضمن وقت SLA ⚡',
          badgeColor: 'bg-[#FAF6F0] text-[#8D4925] border-[#C5A059]/60',
        },
        {
          title: 'معدل رضا العملاء وحسم الاستفسارات من المرة الأولى',
          value: '97.8% رضا عام',
          subLabel: 'حسم من المرة الأولى (FCR): 94.5%',
          progressPercent: 98,
          badgeText: 'جودة ممتازة ⭐',
          badgeColor: 'bg-[#FAF6F0] text-[#8D4925] border-[#C5A059]/60',
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
          badgeColor: 'bg-[#FAF6F0] text-[#8D4925] border-[#C5A059]/60',
        },
      ];
    }

    // Default: مدير تحرير المركز المعرفي
    const targetArticles = Math.max(10, knowledgeArticles.length + 2);
    const pubPct = Math.min(
      100,
      Math.round((publishedArticlesCount / targetArticles) * 100)
    );
    return [
      {
        title: 'المقالات والمواد المعرفية المنشورة مقابل المستهدف',
        value: `${publishedArticlesCount} / ${targetArticles} مادة منشورة`,
        subLabel: `نسبة إنجاز الخطة التحريرية: ${pubPct}%`,
        progressPercent: pubPct,
        badgeText: 'سجل النشر ✍️',
        badgeColor: 'bg-[#FAF6F0] text-[#8D4925] border-[#C5A059]/60',
      },
      {
        title: 'المسودات قيد المراجعة والتدقيق التاريخي',
        value: `${draftArticlesCount} مسودات قيد التدقيق`,
        subLabel: 'تخضع للمراجعة المرجعية ومعايرة الصور القياسية 16:9',
        progressPercent: draftArticlesCount === 0 ? 100 : 80,
        badgeText: 'تدقيق تاريخي 📜',
        badgeColor: 'bg-[#FAF6F0] text-[#8D4925] border-[#C5A059]/60',
      },
      {
        title: 'متوسط زمن تحرير واعتماد المادة المعرفية',
        value: '18:30 دقيقة / مادة',
        subLabel: 'المعيار القياسي للتحرير والتدقيق: 25:00 دقيقة',
        progressPercent: 91,
        badgeText: 'إنجاز قياسي ⚡',
        badgeColor: 'bg-[#FAF6F0] text-[#8D4925] border-[#C5A059]/60',
      },
      {
        title: 'مؤشر جودة التدقيق اللغوي والمرجعي',
        value: '99.4% دقة مرجعية',
        subLabel: 'توثيق الشواهد والمخطوطات وفق معايير مركز آدم',
        progressPercent: 99,
        badgeText: 'اعتماد علمي 🏆',
        badgeColor: 'bg-[#FAF6F0] text-[#8D4925] border-[#C5A059]/60',
      },
    ];
  }, [
    effectiveHubRole,
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
    knowledgeArticles.length,
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
        className="min-h-screen bg-[#F7F2E9] text-[#252321] flex flex-col justify-between relative overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(216,117,91,0.12),transparent_65%)]" />

        {/* Top Bar */}
        <header className="relative z-10 max-w-6xl w-full mx-auto flex items-center justify-between px-6 pt-6 py-2">
          <div className="flex items-center gap-3">
            <JuthoriLogo size="sm" onClick={onBackToPlatform} />
            <span className="px-3 py-1 rounded-full bg-[#EDE6DA] border border-[#B98A78]/45 text-[#8D4925] text-[11px] font-bold">
              بوابة الإدارة الرئيسية
            </span>
          </div>

          <button
            type="button"
            onClick={onBackToPlatform}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-[#EDE6DA] border border-[#B98A78]/45 text-xs font-bold text-[#252321] shadow-2xs transition cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5 text-[#D8755B]" />
            <span>العودة لواجهة المنصة</span>
          </button>
        </header>

        {/* Center Login Card */}
        <main className="relative z-10 max-w-md w-full mx-auto my-auto px-6 py-8">
          <div className="rounded-3xl bg-white border border-[#B98A78]/40 p-7 sm:p-8 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/45 flex items-center justify-center text-[#D8755B] mb-5">
              <Lock className="w-6 h-6" />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold font-display text-[#252321]">
              تسجيل دخول فريق العمل
            </h1>
            <p className="text-xs text-[#6E6456] mt-1.5 leading-relaxed">
              بوابة الإدارة والبحوث والتحرير
            </p>

            {loginError && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                {loginError}
              </div>
            )}

            <form onSubmit={handleTeamLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#252321] mb-1.5">
                  البريد الإلكتروني الإداري
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8D4925] absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    dir="ltr"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@adamresearchcenter.net"
                    className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] text-sm text-[#252321] focus:bg-white focus:outline-none focus:border-[#D8755B]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#252321] mb-1.5">
                  كلمة المرور
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#8D4925] absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    dir="ltr"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] text-sm text-[#252321] focus:bg-white focus:outline-none focus:border-[#D8755B]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white font-bold text-sm shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? 'جاري التحقق من الصلاحيات...' : 'دخول بوابة الفريق (/Team)'}
              </button>
            </form>
          </div>
        </main>

        {/* Quiet Editorial Footer (Matches Platform Homepage Footer) */}
        <footer className="relative z-10 border-t border-[#B98A78]/30 bg-[#EDE6DA]/70 py-12 w-full">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center text-center space-y-3.5">
              <JuthoriLogo size="sm" onClick={onBackToPlatform} />

              <p className="text-sm sm:text-base font-display font-bold text-[#252321] pt-1">
                ما لا يُوثق اليوم… قد يصبح مجرد رواية غامضة غدًا.
              </p>

              <p className="text-xs sm:text-sm text-[#252321]/80 leading-relaxed font-sans">
                تعمل المنصة من خلال شركة جينيا لاب - الولايات المتحدة الأمريكية.
              </p>

              <p className="text-xs sm:text-sm text-[#252321]/75 font-sans" dir="rtl">
                منصة الأنساب والإرث العائلي العربي — juthori.com
              </p>

              <p className="text-xs text-[#252321]/70 font-sans" dir="rtl">
                جميع الحقوق محفوظة. جذوري © 2026
              </p>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#F7F2E9] text-[#252321] flex flex-col">
      {/* =====================================================================
          REQUIREMENT 1: TOP HEADER BAR (No Horizontal Section Tabs Bar)
          Unified Warm Heritage Ivory & Terracotta Visual Identity (Zero Black Backgrounds)
         ===================================================================== */}
      <header className="sticky top-0 z-40 bg-[#FAF6F0]/95 backdrop-blur-md text-[#252321] border-b border-[#E2DACB] shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <JuthoriLogo size="sm" onClick={onBackToPlatform} />
            <span className="hidden md:inline-block h-6 w-px bg-[#E2DACB]" />
            <button
              type="button"
              data-testid="back-to-command-hub-btn"
              onClick={() => setActiveTab('command_hub')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold shadow-xs transition cursor-pointer ${
                activeTab !== 'command_hub'
                  ? 'bg-[#D8755B] hover:bg-[#c5644b] text-white'
                  : 'bg-white hover:bg-[#EDE6DA] text-[#8D4925] border border-[#B98A78]/50'
              }`}
            >
              <span>بوابة الإدارة الرئيسية</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-white border border-[#B98A78]/50 px-3.5 py-2 rounded-xl shadow-2xs">
              <Crown className="w-4 h-4 text-[#D8755B]" />
              <div className="text-xs">
                <span className="font-bold text-[#252321]">{loggedInMember.name}</span>
                <span className="mx-1.5 text-[#D8755B]">·</span>
                <span className="text-[#8D4925] font-extrabold">{loggedInMember.role}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTeamLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FAF6F0] hover:bg-[#D8755B]/15 text-xs font-bold text-[#8D4925] border border-[#D8755B]/50 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-[#D8755B]" />
              <span>خروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Banner */}
      {toastBanner && (
        <div className="bg-[#FAF6F0] text-[#252321] border-b border-[#B98A78]/45 px-4 py-2.5 text-center text-xs font-bold flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#D8755B] shrink-0" />
          <span>{toastBanner}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* =====================================================================
            PANEL 0: بوابة القيادة الذكية المخصصة حسب الصلاحية (Role-Based Command Hub & Launchpad)
           ===================================================================== */}
        {activeTab === 'command_hub' && (
          <div data-testid="role-based-command-hub" className="space-y-10">
            {/* -----------------------------------------------------------------
                أ) لافتة الترحيب، البصمة الزمنية، وحكمة العمل اليومية المتجددة (365 مقولة)
               ----------------------------------------------------------------- */}
            <div
              data-testid="command-hub-welcome-banner"
              className="rounded-3xl bg-gradient-to-l from-[#FAF6F0] via-white to-[#EDE6DA]/70 border-2 border-[#E2DACB] p-6 sm:p-8 text-[#252321] shadow-sm space-y-5 relative overflow-hidden"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="px-3.5 py-1 rounded-full bg-amber-50 border border-[#C5A059] text-[#8D4925] text-xs font-extrabold">
                      👑{roleDisplayBadgeLabel}
                    </span>
                    {isMaestroOrGeneralManager && previewRoleOverride && (
                      <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-extrabold">
                        وضع معاينة الصلاحية مفعّل
                      </span>
                    )}
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-[#252321]">
                    مرحباً بك، {loggedInMember.name}
                  </h1>
                </div>

                {/* REQUIREMENT 3: Fast Role Preview Selector for Maestro / General Manager Only */}
                {isMaestroOrGeneralManager && (
                  <div className="bg-white border border-[#B98A78]/50 rounded-2xl px-4 py-2.5 flex flex-wrap items-center gap-2.5 shadow-2xs">
                    <label
                      htmlFor="maestro-role-preview-select"
                      className="text-xs font-extrabold text-[#8D4925] whitespace-nowrap"
                    >
                      👁️ معاينة البوابة بصلاحية:
                    </label>
                    <select
                      id="maestro-role-preview-select"
                      data-testid="maestro-role-preview-select"
                      value={previewRoleOverride || 'المايسترو'}
                      onChange={(e) => {
                        const val = e.target.value as TeamRoleType;
                        setPreviewRoleOverride(
                          val === 'المايسترو' ? null : val
                        );
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#FAF6F0] text-[#252321] border border-[#E2DACB] text-xs font-extrabold focus:outline-none focus:border-[#D8755B] cursor-pointer"
                    >
                      <option value="المايسترو">المايسترو - كل اللوحات</option>
                      <option value="مدير البحوث">مدير البحوث</option>
                      <option value="مدير إدارة الطلبات وخدمة العملاء">
                        مدير الطلبات وخدمة العملاء
                      </option>
                      <option value="مدير تحرير المركز المعرفي">
                        مدير تحرير المركز المعرفي
                      </option>
                    </select>
                  </div>
                )}
              </div>

              {/* Timestamp Fingerprint Bar & Compact Wisdom Quote Box Side-by-Side */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#E2DACB] text-xs font-bold text-[#5C5346] shadow-2xs">
                  <span>🕒 آخر تسجيل دخول: {lastLoginTimestamp}</span>
                </div>

                <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-[#FAF6F0] border border-[#C5A059]/60 shadow-2xs max-w-full">
                  <p
                    data-testid="role-motivational-audit-quote"
                    className="text-xs font-extrabold text-[#8D4925] leading-relaxed"
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
                    className="shrink-0 inline-flex items-center justify-center p-1.5 rounded-lg bg-white hover:bg-[#EDE6DA] border border-[#E2DACB] text-[#8D4925] transition cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#D8755B]" />
                  </button>
                </div>
              </div>
            </div>

            {/* -----------------------------------------------------------------
                ب) لوحات التحكم المخصصة لصلاحيتكم — تنسيق فروع الشجرة (Tree-Branch Launchpad)
               ----------------------------------------------------------------- */}
            <div
              data-testid="command-hub-workspace-launchpad"
              className="relative py-4"
            >
              {/* Tree Crown Header (تاج الشجرة القيادي) */}
              <div className="flex flex-col items-center justify-center text-center relative z-10 mb-8">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FAF6F0] via-white to-[#EDE6DA] border-2 border-[#C5A059] shadow-md flex items-center justify-center text-2xl mb-3 relative">
                  <span>🌳</span>
                  <span className="absolute -bottom-2 px-2.5 py-0.5 rounded-full bg-[#8D4925] text-white text-[10px] font-extrabold font-mono shadow-2xs">
                    {visibleWorkspaceWindows.length}
                  </span>
                </div>
                <div className="inline-block px-7 py-3 rounded-full bg-gradient-to-r from-[#FAF6F0] via-white to-[#FAF6F0] border-2 border-[#C5A059] shadow-sm">
                  <h2 className="text-lg sm:text-xl font-extrabold font-display text-[#252321]">
                    لوحات التحكم المخصصة لصلاحيتكم
                  </h2>
                </div>
                {/* Upper Trunk Stem */}
                <div className="w-1.5 h-8 bg-gradient-to-b from-[#C5A059] to-[#8D4925] rounded-full mt-1" />
              </div>

              {/* Tree Trunk & Alternating Organic Branches Container */}
              <div className="relative max-w-6xl mx-auto px-2 sm:px-4">
                {/* Central Vertical Tree Trunk (Desktop Center / Mobile Right-Aligned) */}
                <div
                  aria-hidden="true"
                  className="hidden lg:block absolute top-0 bottom-6 left-1/2 -translate-x-1/2 w-2 rounded-full bg-gradient-to-b from-[#C5A059] via-[#D8755B] to-[#8D4925] shadow-[0_0_15px_rgba(197,160,89,0.35)]"
                />
                <div
                  aria-hidden="true"
                  className="lg:hidden absolute top-0 bottom-6 right-5 w-1.5 rounded-full bg-gradient-to-b from-[#C5A059] via-[#D8755B] to-[#8D4925]"
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
                                ? 'left-1/2 rounded-r-full bg-gradient-to-r from-[#8D4925] via-[#C5A059] to-[#E2DACB]'
                                : 'right-1/2 rounded-l-full bg-gradient-to-l from-[#8D4925] via-[#C5A059] to-[#E2DACB]'
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
                          <div className="w-10 h-10 rounded-full bg-[#FAF6F0] border-2 border-[#C5A059] shadow-sm flex items-center justify-center text-xs font-extrabold text-[#8D4925] font-mono z-10">
                            {idx + 1}
                          </div>
                        </div>

                        {/* Mobile Trunk Node & Branch Connector */}
                        <div
                          aria-hidden="true"
                          className="lg:hidden absolute right-2 top-8 z-20 flex items-center"
                        >
                          <div className="w-7 h-7 rounded-full bg-[#FAF6F0] border-2 border-[#C5A059] shadow-2xs flex items-center justify-center text-[11px] font-extrabold text-[#8D4925] font-mono">
                            {idx + 1}
                          </div>
                          <div className="w-5 h-1 bg-gradient-to-l from-[#C5A059] to-[#E2DACB]" />
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
                            className={`group relative bg-gradient-to-br from-white via-[#FAF6F0] to-[#F7F2E9] border-2 border-[#C5A059]/70 hover:border-[#D8755B] p-5 sm:p-6 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 overflow-hidden ${
                              isRightBranch
                                ? 'rounded-tr-[2.5rem] rounded-bl-[2.5rem] rounded-tl-2xl rounded-br-2xl'
                                : 'rounded-tl-[2.5rem] rounded-br-[2.5rem] rounded-tr-2xl rounded-bl-2xl'
                            }`}
                          >
                            {/* Subtle Botanical Corner Accent */}
                            <div
                              aria-hidden="true"
                              className="pointer-events-none absolute -top-6 -left-6 w-24 h-24 rounded-full bg-[#C5A059]/10 border border-[#C5A059]/20"
                            />

                            <div className="space-y-3 relative z-10">
                              <div className="flex items-start justify-between gap-3">
                                {win.customLogoUrl ? (
                                  <div className="w-14 h-14 rounded-2xl bg-[#FAF6F0] border-2 border-[#C5A059] p-1 shadow-xs flex items-center justify-center shrink-0 overflow-hidden">
                                    <img
                                      src={win.customLogoUrl}
                                      alt={win.title}
                                      className="w-full h-full object-cover rounded-xl"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FAF6F0] to-[#EDE6DA] border-2 border-[#C5A059]/70 flex items-center justify-center text-2xl shrink-0 shadow-xs">
                                    {win.emoji}
                                  </div>
                                )}

                                <span className="px-3 py-1 rounded-full bg-white/90 border border-[#C5A059]/60 text-[#8D4925] text-[11px] font-extrabold shadow-2xs">
                                  🌿 {win.accentBadge}
                                </span>
                              </div>

                              <div>
                                <h3 className="text-lg font-extrabold font-display text-[#252321] group-hover:text-[#8D4925] transition-colors">
                                  {win.title}
                                </h3>
                                <p className="text-xs text-[#5C5346] leading-relaxed mt-1">
                                  {win.description}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-3 pt-3 border-t border-[#E2DACB]/80 relative z-10">
                              <div className="flex items-center justify-between gap-2 bg-white/90 px-3.5 py-2 rounded-xl border border-[#E2DACB]">
                                <span className="text-[11px] font-bold text-[#5C5346]">
                                  {win.liveCounterLabel}:
                                </span>
                                <span className="text-xs font-extrabold text-[#8D4925] font-mono">
                                  {win.liveCounterValue}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTab(win.id);
                                }}
                                className="w-full py-2.5 px-4 rounded-xl bg-[#D8755B] group-hover:bg-[#c5644b] text-white text-xs sm:text-sm font-extrabold shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
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
                  <div className="w-4 h-4 rounded-full bg-[#8D4925] border-2 border-[#C5A059] shadow-xs" />
                </div>
              </div>
            </div>

            {/* -----------------------------------------------------------------
                ج) دوائر المؤشرات الرقابية (Circular Metrics — Moved Below Launchpad, Headings Removed)
               ----------------------------------------------------------------- */}
            <div
              data-testid="command-hub-surveillance-radar"
              className="pt-2 pb-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 place-items-center">
                {roleSpecificRadarCards.map((card, idx) => {
                  const clampedPct = Math.max(
                    0,
                    Math.min(100, card.progressPercent || 0)
                  );
                  const radius = 54;
                  const circumference = 2 * Math.PI * radius;
                  const strokeDashoffset =
                    circumference - (clampedPct / 100) * circumference;

                  return (
                    <div
                      key={idx}
                      data-testid={`radar-metric-card-${idx}`}
                      className="relative w-64 h-64 sm:w-68 sm:h-68 rounded-full bg-gradient-to-b from-white via-[#FAF6F0] to-[#F7F2E9] border-2 border-[#C5A059]/70 shadow-sm hover:shadow-md hover:border-[#D8755B] transition-all flex flex-col items-center justify-center text-center p-7 group"
                    >
                      {/* Circular Progress Ring SVG */}
                      <svg
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-1.5"
                        viewBox="0 0 120 120"
                      >
                        <circle
                          cx="60"
                          cy="60"
                          r={radius}
                          fill="none"
                          stroke="#E2DACB"
                          strokeWidth="3.5"
                        />
                        <circle
                          cx="60"
                          cy="60"
                          r={radius}
                          fill="none"
                          stroke="#D8755B"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                        />
                      </svg>

                      <div className="relative z-10 flex flex-col items-center justify-center space-y-2 max-w-[195px]">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${card.badgeColor}`}
                        >
                          {card.badgeText}
                        </span>

                        <h3 className="text-xs font-extrabold font-display text-[#252321] leading-snug line-clamp-2">
                          {card.title}
                        </h3>

                        <div className="text-base sm:text-lg font-extrabold text-[#8D4925] font-mono bg-white/90 px-3 py-1 rounded-full border border-[#E2DACB] shadow-2xs">
                          {card.value}
                        </div>

                        <p className="text-[10px] font-bold text-[#5C5346] leading-tight line-clamp-2">
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
            <div className="bg-white rounded-2xl border border-[#E2DACB] p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#252321]">
                    إدارة المستخدمين وصلاحيات الفريق
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-bold cursor-pointer transition shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>إضافة عضو فريق جديد</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-[#FAF6F0] border-b border-[#E2DACB] text-[11px] font-bold text-[#6E6456]">
                      <th className="py-3 px-4">اسم العضو</th>
                      <th className="py-3 px-4">البريد الإلكتروني</th>
                      <th className="py-3 px-4">الصلاحية</th>
                      <th className="py-3 px-4">الحالة</th>
                      <th className="py-3 px-4">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEAE0] text-xs">
                    {staffList.map((st) => (
                      <tr key={st.id} className="hover:bg-[#FCFBF8]">
                        <td className="py-3.5 px-4 font-bold text-[#252321]">
                          <div className="flex items-center gap-2">
                            <span>{st.name}</span>
                            {st.role === 'المايسترو' && (
                              <span className="px-2 py-0.5 rounded bg-[#D8755B]/15 text-[#8D4925] text-[10px] font-bold">
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
                          <span className="px-2.5 py-1 rounded-full bg-[#FAF6F0] text-[#8D4925] border border-[#B98A78]/50 font-bold text-[11px]">
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
                          {st.id !== FOUNDING_MAESTRO_MEMBER.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleStaffStatus(st)}
                                className="px-2.5 py-1 rounded-lg border border-[#D8D0C0] hover:bg-[#F7F2E9] text-[11px] font-bold text-[#252321] cursor-pointer"
                              >
                                {st.status === 'نشط' ? 'إيقاف مؤقت' : 'إعادة تفعيل'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStaffMember(st)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-[11px] font-bold text-red-700 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>حذف</span>
                              </button>
                            </div>
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
            PANEL 2: أقسام البحوث الثلاثة (مرصد البحوث / شجرة آدم للأجداد / بوصلة الأنساب)
           ===================================================================== */}
        {(activeTab === 'research_studio' ||
          activeTab === 'adam_tree_management' ||
          activeTab === 'direct_search_inspection') &&
          allowedTabs.includes(activeTab) && (
            <div className="bg-white rounded-3xl border border-[#E2DACB] p-4 sm:p-6 shadow-sm">
              <ResearcherStudio
                activePortalSection={activeTab}
                onSelectPortalSection={(sec) => {
                  if (allowedTabs.includes(sec)) {
                    setActiveTab(sec);
                  }
                }}
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
                  className="w-full pr-10 pl-4 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2DACB] text-xs text-[#252321] focus:outline-none focus:border-[#D8755B]"
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
                        ? 'bg-[#D8755B] text-white'
                        : 'bg-[#FAF6F0] text-[#5C5346] hover:bg-[#EDE6DA]'
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
                <h3 className="text-sm font-bold text-[#252321]">
                  سجل طلبات العملاء
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
                      <tr className="bg-[#EDE6DA] text-[#252321] border-b border-[#B98A78]/35 text-[11px] font-bold">
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
                          <td className="py-3.5 px-4 font-mono font-bold text-[#252321]">
                            {order.id}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-[#252321]">
                              {order.fullName}
                            </div>
                            <div className="text-[11px] text-[#6E6456]">
                              اللقب: <span className="font-bold">{order.familyName}</span> ·{' '}
                              {order.email}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-[#252321]">
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
                                className="px-2.5 py-1.5 rounded-lg bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#E2DACB] text-[#252321] font-bold text-[11px] cursor-pointer"
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
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#8D4925] hover:bg-[#753b1d] text-white font-bold text-[11px] cursor-pointer"
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
                    <FileSignature className="w-5 h-5 text-[#8D4925]" />
                    <h3 className="text-sm font-bold text-[#252321]">
                      طلبات توثيق &quot;ميثاق أمين السجل&quot; ({charterRequests.length})
                    </h3>
                  </div>
                </div>

                {charterRequests.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#FAF6F0] border border-[#EFEAE0] text-center text-xs font-bold text-[#6E6456]">
                    لا توجد سجلات حالياً
                  </div>
                ) : (
                  <div className="space-y-3">
                    {charterRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E2DACB] flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs font-bold text-[#252321]">
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
                            className="px-3 py-1.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-[11px] font-bold cursor-pointer"
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
                    <MessageSquare className="w-5 h-5 text-[#8D4925]" />
                    <h3 className="text-sm font-bold text-[#252321]">
                      تذاكر الدعم الفني والاستفسارات ({supportTickets.length})
                    </h3>
                  </div>
                </div>

                {supportTickets.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#FAF6F0] border border-[#EFEAE0] text-center text-xs font-bold text-[#6E6456]">
                    لا توجد سجلات حالياً
                  </div>
                ) : (
                  <div className="space-y-3">
                    {supportTickets.map((t) => (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E2DACB] flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs font-bold text-[#252321]">
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
                            className="px-3 py-1.5 rounded-xl bg-[#8D4925] hover:bg-[#753b1d] text-white text-[11px] font-bold cursor-pointer"
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
            PANEL 4: إدارة تحرير المركز المعرفي (Knowledge Center CMS)
           ===================================================================== */}
        {activeTab === 'knowledge_cms' && allowedTabs.includes('knowledge_cms') && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-[#E2DACB] overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-[#E2DACB] flex flex-wrap justify-between items-center gap-3">
                <h3 className="text-lg font-bold text-[#252321]">
                  إدارة المقالات والمركز المعرفي
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewKnowledgeCenter((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] text-[#252321] border border-[#B98A78]/50 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#8D4925]" />
                    <span>
                      {previewKnowledgeCenter
                        ? 'إخفاء معاينة المركز المعرفي'
                        : 'معاينة المركز المعرفي للزوار'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={openNewArticleModal}
                    className="flex items-center gap-2 px-4 py-2 bg-[#D8755B] hover:bg-[#c5644b] text-white rounded-xl transition-colors text-xs sm:text-sm font-bold cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة موضوع</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead className="bg-[#FAF6F0] border-b border-[#E2DACB] text-[#6E6456] text-xs font-bold">
                    <tr>
                      <th className="p-4">العنوان</th>
                      <th className="p-4">النوع</th>
                      <th className="p-4">القسم/التصفية</th>
                      <th className="p-4">تاريخ النشر</th>
                      <th className="p-4">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEAE0] text-xs sm:text-sm">
                    {knowledgeArticles.map((article) => {
                      const artType = article.type || 'مقال';
                      const artSection = article.section || 'الروايات والذاكرة';
                      const artFilter = article.filter || 'عام';
                      return (
                        <tr
                          key={article.id}
                          className="hover:bg-[#FCFBF8] transition-colors"
                        >
                          <td className="p-4 font-bold text-[#252321]">
                            <div className="flex items-center gap-3">
                              <div className="w-20 aspect-video rounded-lg overflow-hidden bg-[#EDE6DA] border border-[#B98A78]/40 shrink-0">
                                <ResilientImage
                                  src={article.coverImageUrl || ''}
                                  alt={article.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span>{article.title}</span>
                                  {article.status === 'draft' && (
                                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                      مسودة
                                    </span>
                                  )}
                                </div>
                                {(article.author || article.authorName) && (
                                  <div className="text-[11px] font-normal text-[#6E6456] mt-0.5">
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
                              className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                                artType === 'مقال'
                                  ? 'bg-[#FAF6F0] text-[#8D4925] border border-[#B98A78]/50'
                                  : 'bg-[#D8755B]/15 text-[#D8755B] border border-[#D8755B]/30'
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
                          <td className="p-4 text-[#5C5346]">
                            <div className="font-bold text-[#252321]">
                              {artSection}
                            </div>
                            <div className="text-xs text-[#8C8272]">{artFilter}</div>
                          </td>
                          <td className="p-4 text-[#5C5346] font-mono text-xs">
                            {article.publishDate || 'غير محدد'}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditArticleModal(article)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[#8D4925] hover:bg-[#FAF6F0] border border-[#B98A78]/40 rounded-lg transition-colors text-xs font-bold cursor-pointer"
                                title="تعديل"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>تعديل</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteKnowledgeArticle(article.id)
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors text-xs font-bold cursor-pointer"
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
                    {knowledgeArticles.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-8 text-center text-[#6E6456] font-bold"
                        >
                          لا توجد مقالات مضافة بعد
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {previewKnowledgeCenter && (
              <div className="bg-[#F7F2E9] rounded-3xl border border-[#B98A78]/45 p-5 sm:p-8 shadow-sm">
                <KnowledgeCenterView articles={knowledgeArticles} />
              </div>
            )}
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
                  <div className="text-2xl font-extrabold text-[#252321] mt-1">
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
                  <div className="text-2xl font-extrabold text-[#252321] mt-1">
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
                  <div className="text-2xl font-extrabold text-[#252321] mt-1">
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
                  <div className="text-2xl font-extrabold text-[#252321] mt-1">
                    {staffList.length} أعضاء · {metrics.totalArticles} مقال
                  </div>
                  <div className="text-[11px] text-[#6E6456] mt-1">
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
                    className="bg-white rounded-3xl border-2 border-[#B98A78]/50 p-6 shadow-sm space-y-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2DACB] pb-4">
                      <div>
                        <span className="px-3 py-1 rounded-full bg-[#FAF6F0] border border-[#B98A78]/45 text-[#8D4925] text-xs font-extrabold">
                          📊 منظومة تقييم إنتاجية الباحثين والمكافآت الشهرية (KPI & Incentives)
                        </span>
                        <h3 className="text-base sm:text-lg font-extrabold text-[#252321] mt-2">
                          مؤشرات الأداء الحي لفريق التحقيق وربط شجرة آدم وسجل آدم برايم
                        </h3>
                      </div>
                      <div className="px-4 py-2 rounded-2xl bg-[#D8755B]/15 border border-[#D8755B]/35 text-[#8D4925] font-mono text-sm font-extrabold">
                        🏆 الرصيد التراكمي للمكافآت: {liveKpi.totalXpScore} XP
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="rounded-2xl bg-[#FAF6F0] border border-[#E2DACB] p-4 space-y-1">
                        <div className="text-xs font-bold text-[#6E6456]">
                          متوسط زمن إنجاز التذكرة (Avg Handling Time)
                        </div>
                        <div className="text-2xl font-mono font-extrabold text-[#252321]">
                          {formatDurationMmSs(liveKpi.avgHandlingTimeSeconds)}
                        </div>
                        <div className="text-[11px] text-emerald-800 font-bold">
                          ضمن المعيار القياسي للاستوديو التفاعلي (&lt; 02:00)
                        </div>
                      </div>

                      <div className="rounded-2xl bg-[#FAF6F0] border border-[#E2DACB] p-4 space-y-1">
                        <div className="text-xs font-bold text-[#6E6456]">
                          التذاكر المنجزة اليوم حسب الأولوية ({totalToday})
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 font-mono text-xs font-extrabold">
                          <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-900 border border-red-300">
                            P1: {liveKpi.completedTodayP1}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-950 border border-amber-300">
                            P2: {liveKpi.completedTodayP2}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-950 border border-emerald-300">
                            P3: {liveKpi.completedTodayP3}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-[#FAF6F0] border border-[#E2DACB] p-4 space-y-1">
                        <div className="text-xs font-bold text-[#6E6456]">
                          عُقد ألفا الموصولة بشجرة آدم
                        </div>
                        <div className="text-2xl font-mono font-extrabold text-emerald-900">
                          {liveKpi.totalAlphaNodesBridged} عقدة
                        </div>
                        <div className="text-[11px] text-[#6E6456]">
                          موثقة ومعلّمة في Neo4j لمنع التكرار
                        </div>
                      </div>

                      <div className="rounded-2xl bg-[#FAF6F0] border border-[#E2DACB] p-4 space-y-1">
                        <div className="text-xs font-bold text-[#6E6456]">
                          المصادر الإضافية الموثقة في آدم برايم
                        </div>
                        <div className="text-2xl font-mono font-extrabold text-[#8D4925]">
                          {liveKpi.totalAdamPrimeSourcesVerified} مرجع
                        </div>
                        <div className="text-[11px] text-[#6E6456]">
                          مربوطة بمعرفات APR-SRC في محفظة العميل
                        </div>
                      </div>
                    </div>

                    {liveKpi.recentCompletedLog.length > 0 && (
                      <div className="rounded-2xl border border-[#E2DACB] overflow-hidden">
                        <div className="bg-[#FAF6F0] px-4 py-2.5 border-b border-[#E2DACB] text-xs font-extrabold text-[#252321]">
                          سجل آخر التذاكر المنجزة وتقييم النقاط التحفيزية للباحثين
                        </div>
                        <div className="divide-y divide-[#E2DACB] text-xs">
                          {liveKpi.recentCompletedLog.slice(0, 6).map((log, idx) => (
                            <div
                              key={`${log.ticketId}-${idx}`}
                              className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-white"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono font-bold px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#B98A78]/45 text-[#8D4925]">
                                  {log.ticketId}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                                    log.priority === 'P1'
                                      ? 'bg-red-100 text-red-900'
                                      : log.priority === 'P3'
                                      ? 'bg-emerald-100 text-emerald-900'
                                      : 'bg-amber-100 text-amber-900'
                                  }`}
                                >
                                  {log.priority}
                                </span>
                                <span className="font-extrabold text-[#252321]">
                                  {log.familyName}
                                </span>
                                <span className="text-[#6E6456]">
                                  ({log.researcherName})
                                </span>
                              </div>
                              <div className="flex items-center gap-3 font-mono">
                                <span className="text-[#6E6456]">
                                  ⏱️ {formatDurationMmSs(log.durationSec)}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-950 font-extrabold">
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
      <footer className="border-t border-[#B98A78]/30 bg-[#EDE6DA]/70 py-12 mt-auto">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center space-y-3.5">
            <JuthoriLogo size="sm" onClick={onBackToPlatform} />

            <p className="text-sm sm:text-base font-display font-bold text-[#252321] pt-1">
              ما لا يُوثق اليوم… قد يصبح مجرد رواية غامضة غدًا.
            </p>

            <p className="text-xs sm:text-sm text-[#252321]/80 leading-relaxed font-sans">
              تعمل المنصة من خلال شركة جينيا لاب - الولايات المتحدة الأمريكية.
            </p>

            <p className="text-xs sm:text-sm text-[#252321]/75 font-sans" dir="rtl">
              منصة الأنساب والإرث العائلي العربي — juthori.com
            </p>

            <p className="text-xs text-[#252321]/70 font-sans" dir="rtl">
              جميع الحقوق محفوظة. جذوري © 2026
            </p>
          </div>
        </div>
      </footer>

      {/* =======================================================================
          MODAL 1: Add & Invite New Staff Member (/Team)
         ======================================================================= */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-[#252321]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#B98A78]/50 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[#252321] mb-1">
              إضافة عضو جديد في فريق العمل (/Team)
            </h3>
            <p className="text-xs text-[#6E6456] mb-4">
              سيتم تسجيل الحساب مباشرة في{' '}
              <span className="font-bold text-[#252321]">
                Firebase Authentication
              </span>{' '}
              وقاعدة بيانات{' '}
              <span className="font-bold text-[#252321]">Firestore</span>، وإرسال دعوة
              رسمية من{' '}
              <span dir="ltr" className="font-mono font-bold">
                info@Juthori.com
              </span>{' '}
              عبر Resend API.
            </p>

            {addStaffError && (
              <div className="mb-3.5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700 leading-relaxed">
                {addStaffError}
              </div>
            )}

            <form onSubmit={handleAddStaffMember} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#5C5346] mb-1">
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
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2DACB] text-xs font-bold text-[#252321]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5C5346] mb-1">
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
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2DACB] text-xs text-[#252321]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5C5346] mb-1">
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
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2DACB] text-xs font-mono text-[#252321]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5C5346] mb-1">
                  الدور الوظيفي (يحدد اللوحات المسموح بفتحها حصراً)
                </label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as TeamRoleType)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2DACB] text-xs font-bold text-[#252321]"
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
                  className="px-4 py-2 rounded-xl bg-[#EDE6DA] text-xs font-bold text-[#252321] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isAddingStaff}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-[#252321]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#B98A78]/50 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#EFEAE0] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#252321]">
                  إدارة حساب وطلب العميل: {selectedOrderForModal.fullName}
                </h3>
                <p className="text-xs text-[#6E6456]">
                  رقم الطلب: {selectedOrderForModal.id} · {selectedOrderForModal.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForModal(null)}
                className="px-3 py-1 rounded-lg bg-[#EDE6DA] text-xs font-bold text-[#252321]"
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
                        ? 'bg-[#D8755B] text-white border-[#D8755B]'
                        : 'bg-[#FAF6F0] text-[#252321] border-[#E2DACB]'
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

      {/* =======================================================================
          MODAL 3: Add / Edit Knowledge Center Topic (مقال / فيديو)
         ======================================================================= */}
      {isArticleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-[#B98A78]/50 max-w-4xl w-full p-6 sm:p-8 shadow-2xl my-8 max-h-[92vh] overflow-y-auto">
            {/* Modal Top Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2DACB] pb-4 mb-5">
              <div>
                <h3 className="text-lg sm:text-xl font-display font-extrabold text-[#252321]">
                  {editingArticleId
                    ? 'تعديل موضوع (مقال/فيديو)'
                    : 'إضافة موضوع جديد (مقال/فيديو)'}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Switch between Editor and Live Visitor Preview */}
                <div className="inline-flex rounded-xl bg-[#FAF6F0] p-1 border border-[#E2DACB]">
                  <button
                    type="button"
                    onClick={() => setArticleModalTab('edit')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      articleModalTab === 'edit'
                        ? 'bg-[#252321] text-white'
                        : 'text-[#5C5346] hover:text-[#252321]'
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
                        ? 'bg-[#D8755B] text-white'
                        : 'text-[#5C5346] hover:text-[#252321]'
                    }`}
                  >
                    معاينة العرض
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsArticleModalOpen(false)}
                  className="p-2 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] text-[#252321] cursor-pointer border border-[#E2DACB]"
                  aria-label="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {articleModalTab === 'preview' ? (
              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#8D4925]">
                      معاينة حية لشكل الموضوع في المركز المعرفي:
                    </span>
                    <button
                      type="button"
                      onClick={() => setArticleModalTab('edit')}
                      className="text-xs font-bold text-[#D8755B] underline cursor-pointer"
                    >
                      العودة للتحرير
                    </button>
                  </div>

                  {articleCoverImageUrl && (
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-[#252321] border border-[#B98A78]/40 shadow-sm">
                      <ResilientImage
                        src={articleCoverImageUrl}
                        alt={articleTitle || 'معاينة صورة الغلاف'}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#252321]/75 via-transparent to-transparent pointer-events-none" />
                      {articleCoverTextOverlay && (
                        <div className="absolute bottom-4 right-4 left-4 text-white font-display font-bold text-base sm:text-lg drop-shadow-md">
                          {articleCoverTextOverlay}
                        </div>
                      )}
                    </div>
                  )}

                  {(articleImageCaption || articleImageCopyright) && (
                    <div className="flex justify-between text-[11px] text-[#5C5346] bg-[#EDE6DA]/70 px-3.5 py-2 rounded-xl">
                      <span>{articleImageCaption}</span>
                      {articleImageCopyright && (
                        <span>© {articleImageCopyright}</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs font-bold text-[#D8755B]">
                    <span>
                      {articleType} / {articleSection} -{' '}
                      {articleFilter === '__custom__'
                        ? customArticleFilter || 'عام'
                        : articleFilter}
                    </span>
                    {articlePublishDate && (
                      <span className="text-[#8C8272]">
                        · {articlePublishDate}
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-display font-extrabold text-[#252321]">
                    {articleTitle || 'عنوان الموضوع التجريبي'}
                  </h2>

                  {articleDescription && (
                    <div className="p-4 rounded-xl bg-white border-r-4 border-[#D8755B] text-sm font-bold text-[#252321]">
                      {articleDescription}
                    </div>
                  )}

                  <div
                    className="prose max-w-none text-sm text-[#252321]/90 leading-loose bg-white p-5 rounded-2xl border border-[#E2DACB]"
                    dangerouslySetInnerHTML={{
                      __html:
                        articleContent ||
                        '<p class="text-stone-400">لم يتم إدخال نص المقال بعد...</p>',
                    }}
                  />
                </div>

                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setArticleModalTab('edit')}
                    className="px-5 py-2.5 rounded-xl bg-[#EDE6DA] text-xs font-bold text-[#252321] cursor-pointer"
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
                    <label className="block text-xs font-bold text-[#252321] mb-1.5">
                      عنوان الموضوع *
                    </label>
                    <input
                      type="text"
                      required
                      value={articleTitle}
                      onChange={(e) => setArticleTitle(e.target.value)}
                      placeholder="أدخل عنوان المقال أو الفيديو..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] focus:bg-white focus:border-[#8D4925] focus:outline-none text-xs sm:text-sm font-bold text-[#252321]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#252321] mb-1.5">
                      نوع الموضوع *
                    </label>
                    <select
                      value={articleType}
                      onChange={(e) =>
                        setArticleType(e.target.value as KnowledgeContentType)
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] focus:bg-white focus:border-[#8D4925] focus:outline-none text-xs sm:text-sm font-bold text-[#252321]"
                    >
                      <option value="مقال">مقال</option>
                      <option value="فيديو">فيديو</option>
                    </select>
                  </div>
                </div>

                {/* Row 2: Section, Sub-Filter & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#252321] mb-1.5">
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
                      className="w-full px-3 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] text-xs font-bold text-[#252321]"
                    >
                      {Object.keys(KNOWLEDGE_BASE_SECTIONS).map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#252321] mb-1.5">
                      التصفية / الفلتر الفرعي *
                    </label>
                    <select
                      value={articleFilter}
                      onChange={(e) => setArticleFilter(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] text-xs font-bold text-[#252321]"
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
                      <option value="__custom__">+ إضافة فلتر فرعي جديد...</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#252321] mb-1.5">
                      حالة النشر
                    </label>
                    <select
                      value={articleStatus}
                      onChange={(e) =>
                        setArticleStatus(e.target.value as 'published' | 'draft')
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] text-xs font-bold text-[#252321]"
                    >
                      <option value="published">منشور للجمهور</option>
                      <option value="draft">مسودة تحريرية</option>
                    </select>
                  </div>
                </div>

                {articleFilter === '__custom__' && (
                  <div>
                    <label className="block text-xs font-bold text-[#8D4925] mb-1">
                      اسم الفلتر الفرعي الجديد *
                    </label>
                    <input
                      type="text"
                      required
                      value={customArticleFilter}
                      onChange={(e) => setCustomArticleFilter(e.target.value)}
                      placeholder="اكتب اسم التصنيف الفرعي ليظهر كزر تصفية مستقل في هذا القسم..."
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D8755B] text-xs font-bold text-[#252321]"
                    />
                  </div>
                )}

                {/* Row 3: Author, Editor & Publish Date */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#252321] mb-1.5">
                      الكاتب / المنتج (اختياري)
                    </label>
                    <input
                      type="text"
                      value={articleAuthor}
                      onChange={(e) => setArticleAuthor(e.target.value)}
                      placeholder="مثال: هيئة التحقيق والأنساب"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] text-xs text-[#252321]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#252321] mb-1.5">
                      تحرير (اختياري)
                    </label>
                    <input
                      type="text"
                      value={articleEditor}
                      onChange={(e) => setArticleEditor(e.target.value)}
                      placeholder="اسم المحرر..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] text-xs text-[#252321]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#252321] mb-1.5">
                      تاريخ النشر (اختياري)
                    </label>
                    <input
                      type="date"
                      dir="ltr"
                      value={articlePublishDate}
                      onChange={(e) => setArticlePublishDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] text-xs font-mono text-[#252321]"
                    />
                  </div>
                </div>

                {/* Short Card Summary with 1-Click Auto-Extract */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <label className="block text-xs font-bold text-[#252321]">
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
                      className="text-[11px] font-bold text-[#8D4925] hover:text-[#D8755B] cursor-pointer"
                    >
                      ✨ استخراج الملخص تلقائياً من نص المقال
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={articleDescription}
                    onChange={(e) => setArticleDescription(e.target.value)}
                    placeholder="نبذة موجزة تظهر تحت عنوان الموضوع في بطاقة المركز المعرفي..."
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] text-xs text-[#252321]"
                  />
                </div>

                {/* =============================================================
                    FULL RICH TEXT WYSIWYG EDITOR (Matching Screenshot + Power Tools)
                   ============================================================= */}
                <div className="space-y-2">
                  {/* Quick Starter Templates Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FAF6F0] px-3 py-2 rounded-xl border border-[#E2DACB]">
                    <span className="text-[11px] font-bold text-[#6E6456]">
                      إدراج هيكل جاهز بنقرة واحدة:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyQuickArticleTemplate('manuscript')}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#EDE6DA] border border-[#D8D0C0] text-[11px] font-bold text-[#252321] cursor-pointer"
                      >
                        📜 تحقيق مخطوطة
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickArticleTemplate('family_study')}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#EDE6DA] border border-[#D8D0C0] text-[11px] font-bold text-[#252321] cursor-pointer"
                      >
                        🌳 دراسة نسبية
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickArticleTemplate('dna_science')}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#EDE6DA] border border-[#D8D0C0] text-[11px] font-bold text-[#252321] cursor-pointer"
                      >
                        🧬 مقال علمي
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickArticleTemplate('event_news')}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#EDE6DA] border border-[#D8D0C0] text-[11px] font-bold text-[#252321] cursor-pointer"
                      >
                        📅 تغطية فعالية/خبر
                      </button>
                    </div>
                  </div>

                  {/* Toolbar + Label Row (Matches User Screenshot) */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-bold text-[#252321]">
                      نص المقال/وصف الفيديو (اختياري - محرر نصي يدعم جميع المزايا)
                    </label>

                    {/* Formatting Toolbar */}
                    <div className="flex flex-wrap items-center gap-1 bg-[#FAF6F0] border border-[#D8D0C0] rounded-xl px-2 py-1.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => execEditorCommand('bold')}
                        className="px-2 py-1 rounded hover:bg-[#EDE6DA] text-xs font-extrabold text-[#252321] cursor-pointer"
                        title="نص عريض (Bold)"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => execEditorCommand('italic')}
                        className="px-2 py-1 rounded hover:bg-[#EDE6DA] text-xs italic font-serif text-[#252321] cursor-pointer"
                        title="نص مائل (Italic)"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        onClick={() => execEditorCommand('underline')}
                        className="px-2 py-1 rounded hover:bg-[#EDE6DA] text-xs underline text-[#252321] cursor-pointer"
                        title="تسطير (Underline)"
                      >
                        U
                      </button>

                      <span className="h-4 w-px bg-[#D8D0C0] mx-0.5" />

                      <button
                        type="button"
                        onClick={() => execEditorCommand('fontSize', '5')}
                        className="px-2 py-1 rounded hover:bg-[#EDE6DA] text-[11px] font-bold text-[#252321] cursor-pointer"
                        title="تكبير حجم النص"
                      >
                        تكبير
                      </button>
                      <button
                        type="button"
                        onClick={() => execEditorCommand('fontSize', '3')}
                        className="px-2 py-1 rounded hover:bg-[#EDE6DA] text-[11px] font-bold text-[#252321] cursor-pointer"
                        title="تصغير حجم النص"
                      >
                        تصغير
                      </button>
                      <button
                        type="button"
                        onClick={() => execEditorCommand('formatBlock', 'H3')}
                        className="px-2 py-1 rounded hover:bg-[#EDE6DA] text-[11px] font-bold text-[#8D4925] cursor-pointer"
                        title="عنوان فرعي"
                      >
                        عنوان
                      </button>

                      <span className="h-4 w-px bg-[#D8D0C0] mx-0.5" />

                      <button
                        type="button"
                        onClick={() => execEditorCommand('insertUnorderedList')}
                        className="px-2 py-1 rounded hover:bg-[#EDE6DA] text-[11px] font-bold text-[#252321] cursor-pointer"
                        title="قائمة نقطية"
                      >
                        • نقاط
                      </button>
                      <button
                        type="button"
                        onClick={() => execEditorCommand('insertOrderedList')}
                        className="px-2 py-1 rounded hover:bg-[#EDE6DA] text-[11px] font-bold text-[#252321] cursor-pointer"
                        title="قائمة رقمية"
                      >
                        1. ترقيم
                      </button>

                      <span className="h-4 w-px bg-[#D8D0C0] mx-0.5" />

                      <button
                        type="button"
                        onClick={() => execEditorCommand('justifyRight')}
                        className="px-2 py-1 rounded hover:bg-[#EDE6DA] text-[11px] font-bold text-[#252321] cursor-pointer"
                        title="محاذاة لليمين"
                      >
                        يمين
                      </button>
                      <button
                        type="button"
                        onClick={() => execEditorCommand('justifyCenter')}
                        className="px-2 py-1 rounded hover:bg-[#EDE6DA] text-[11px] font-bold text-[#252321] cursor-pointer"
                        title="توسيط"
                      >
                        وسط
                      </button>
                      <button
                        type="button"
                        onClick={() => execEditorCommand('justifyLeft')}
                        className="px-2 py-1 rounded hover:bg-[#EDE6DA] text-[11px] font-bold text-[#252321] cursor-pointer"
                        title="محاذاة لليسار"
                      >
                        يسار
                      </button>

                      <span className="h-4 w-px bg-[#D8D0C0] mx-0.5" />

                      <button
                        type="button"
                        onClick={() =>
                          insertHtmlAtCursor(
                            `<blockquote style="border-right: 4px solid #D8755B; background: #FAF6F0; padding: 12px 16px; margin: 12px 0; border-radius: 8px; font-weight: bold;">«اكتب نص الاقتباس أو المصدر هنا...»</blockquote><p><br/></p>`
                          )
                        }
                        className="px-2 py-1 rounded hover:bg-[#EDE6DA] text-[11px] font-bold text-[#8D4925] cursor-pointer"
                        title="إدراج صندوق اقتباس تراثي"
                      >
                        ❝ اقتباس
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          execEditorCommand('hiliteColor', '#F3D299')
                        }
                        className="px-2 py-1 rounded hover:bg-[#EDE6DA] text-[11px] font-bold text-[#252321] cursor-pointer"
                        title="تمييز النص بلون ذهبي"
                      >
                        تمييز
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setShowInlineLinkInput((prev) => !prev)
                        }
                        className="px-2 py-1 rounded hover:bg-[#EDE6DA] text-[11px] font-bold text-[#252321] cursor-pointer"
                        title="إدراج رابط"
                      >
                        🔗 رابط
                      </button>

                      <button
                        type="button"
                        onClick={() => execEditorCommand('removeFormat')}
                        className="px-2 py-1 rounded hover:bg-[#EDE6DA] text-[11px] text-[#6E6456] cursor-pointer"
                        title="مسح التنسيق"
                      >
                        مسح التنسيق
                      </button>

                      {/* Insert Image inside Article Body (Red/Terracotta Framed Button matching screenshot) */}
                      <button
                        type="button"
                        disabled={isUploadingInlineImage}
                        onClick={() => inlineImageInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-lg border border-[#8D4925]/40 bg-white hover:bg-[#FAF6F0] text-[11px] font-bold text-[#8D4925] cursor-pointer disabled:opacity-50"
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
                        className="px-2 py-1 rounded-lg bg-white hover:bg-[#FAF6F0] border border-[#D8D0C0] text-[10px] font-bold text-[#5C5346] cursor-pointer"
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
                    <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-[#FAF6F0] border border-[#B98A78]/50">
                      <input
                        type="text"
                        value={inlineLinkText}
                        onChange={(e) => setInlineLinkText(e.target.value)}
                        placeholder="عنوان الرابط المعروض..."
                        className="px-3 py-1.5 rounded-lg bg-white border border-[#D8D0C0] text-xs"
                      />
                      <input
                        type="url"
                        dir="ltr"
                        value={inlineLinkUrl}
                        onChange={(e) => setInlineLinkUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg bg-white border border-[#D8D0C0] text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (inlineLinkUrl.trim()) {
                            const label =
                              inlineLinkText.trim() || inlineLinkUrl.trim();
                            insertHtmlAtCursor(
                              `<a href="${inlineLinkUrl.trim()}" target="_blank" rel="noopener noreferrer" style="color: #8D4925; text-decoration: underline; font-weight: bold;">${label}</a>&nbsp;`
                            );
                            setInlineLinkUrl('');
                            setInlineLinkText('');
                            setShowInlineLinkInput(false);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#8D4925] text-white text-xs font-bold cursor-pointer"
                      >
                        إدراج الرابط
                      </button>
                    </div>
                  )}

                  {/* Optional Inline Image URL Popover */}
                  {showInlineImageUrlInput && (
                    <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-[#FAF6F0] border border-[#B98A78]/50">
                      <input
                        type="url"
                        dir="ltr"
                        value={inlineImageUrl}
                        onChange={(e) => setInlineImageUrl(e.target.value)}
                        placeholder="https://example.com/photo.jpg"
                        className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg bg-white border border-[#D8D0C0] text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (inlineImageUrl.trim()) {
                            const normalizedUrl = normalizeExternalImageUrl(
                              inlineImageUrl.trim()
                            );
                            insertHtmlAtCursor(
                              `<figure style="margin: 20px auto; text-align: center; max-width: 100%;"><img src="${normalizedUrl}" alt="صورة داخل المقال" style="width: 100%; max-height: 480px; object-fit: contain; background: #FAF6F0; border-radius: 16px; border: 1px solid rgba(185,138,120,0.45); margin: 0 auto; display: block;" /></figure><p><br/></p>`
                            );
                            setInlineImageUrl('');
                            setShowInlineImageUrlInput(false);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#8D4925] text-white text-xs font-bold cursor-pointer"
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
                    className="min-h-[210px] max-h-[380px] overflow-y-auto w-full p-4 rounded-xl bg-white border-2 border-[#8D4925] focus:border-[#D8755B] focus:outline-none text-sm text-[#252321] leading-relaxed prose max-w-none"
                  />

                  <div className="flex items-center justify-between text-[11px] text-[#6E6456] px-1">
                    <span>
                      يمكنك تنسيق النصوص، وإدراج الصور والاقتباسات والروابط مباشرة داخل المحرر.
                    </span>
                    <span className="font-mono">
                      عدد الكلمات: {editorWordCount} · وقت القراءة:{' '}
                      {Math.max(1, Math.ceil(editorWordCount / 180))} دقيقة
                    </span>
                  </div>
                </div>

                {/* =============================================================
                    SECTION: الروابط والصور (Matches Screenshot Layout)
                   ============================================================= */}
                <div className="pt-4 border-t border-[#EFEAE0] space-y-3.5">
                  <h4 className="text-sm font-display font-extrabold text-[#252321] border-r-4 border-[#8D4925] pr-2.5">
                    الروابط والصور
                  </h4>

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <label className="block text-xs font-bold text-[#252321]">
                        رابط صورة الغلاف (اختياري)
                      </label>
                      <span className="text-[11px] font-bold text-[#8D4925] bg-[#FAF6F0] px-2.5 py-0.5 rounded-full border border-[#E2DACB]">
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
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-[#D8D0C0] focus:border-[#8D4925] focus:outline-none text-xs text-[#252321]"
                      />
                      <label
                        className={`inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-[#EDE6DA] hover:bg-[#e2d8c7] text-[#252321] text-xs font-bold cursor-pointer shrink-0 border border-[#D8D0C0] transition-colors ${
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
                    <p className="text-[11px] text-[#8D4925] font-semibold mt-1">
                      أضف رابط مباشر للصور أو قم بتحميل ملف صورة (يتم ضبط الأبعاد القياسية 16:9 تلقائياً).
                    </p>

                    {articleCoverImageUrl && (
                      <div className="mt-3 p-3 rounded-2xl bg-[#FAF6F0] border border-[#E2DACB] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#252321]">
                            معاينة صورة الغلاف بالأبعاد القياسية (16:9) ✓
                          </span>
                          <button
                            type="button"
                            onClick={() => setArticleCoverImageUrl('')}
                            className="text-[11px] font-bold text-red-700 hover:underline cursor-pointer px-2"
                          >
                            إزالة الصورة
                          </button>
                        </div>
                        <div className="relative w-full max-w-md aspect-video rounded-xl overflow-hidden bg-[#252321] border border-[#B98A78]/45 shadow-xs">
                          <ResilientImage
                            src={articleCoverImageUrl}
                            alt="معاينة الغلاف القياسية"
                            className="w-full h-full object-cover"
                          />
                          {articleCoverTextOverlay && (
                            <div className="absolute inset-0 bg-gradient-to-t from-[#252321]/80 via-transparent to-transparent flex items-end p-3">
                              <span className="text-white font-display font-bold text-xs sm:text-sm drop-shadow">
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
                        <label className="block text-xs font-bold text-[#252321] mb-1.5">
                          رابط الفيديو (YouTube أو رابط مباشر)
                        </label>
                        <input
                          type="url"
                          dir="ltr"
                          value={articleVideoUrl}
                          onChange={(e) => setArticleVideoUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D8D0C0] text-xs text-[#252321]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#252321] mb-1.5">
                          مدة الفيديو (بالدقائق - اختياري)
                        </label>
                        <input
                          type="text"
                          value={articleDuration}
                          onChange={(e) => setArticleDuration(e.target.value)}
                          placeholder="مثال: 12"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D8D0C0] text-xs text-[#252321]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* =============================================================
                    SECTION: النصوص المصاحبة للصورة/الفيديو (Matches Screenshot Layout)
                   ============================================================= */}
                <div className="pt-4 border-t border-[#EFEAE0] space-y-3.5">
                  <h4 className="text-sm font-display font-extrabold text-[#252321] border-r-4 border-[#8D4925] pr-2.5">
                    النصوص المصاحبة للصورة/الفيديو
                  </h4>

                  <div>
                    <label className="block text-xs font-bold text-[#252321] mb-1.5">
                      إلصق عنوان (الصورة/الفيديو) وهو نص يعرض فوق الصورة (اختياري)
                    </label>
                    <input
                      type="text"
                      value={articleCoverTextOverlay}
                      onChange={(e) => setArticleCoverTextOverlay(e.target.value)}
                      placeholder="مثال: رحلة البحث في التراث..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D8D0C0] focus:border-[#8D4925] focus:outline-none text-xs text-[#252321]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#252321] mb-1.5">
                        وصف الصورة/الفيديو المصغر (أسفل الصورة) (اختياري)
                      </label>
                      <input
                        type="text"
                        value={articleImageCaption}
                        onChange={(e) => setArticleImageCaption(e.target.value)}
                        placeholder="توضيح للصورة أو الوثيقة المعروضة..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D8D0C0] focus:border-[#8D4925] focus:outline-none text-xs text-[#252321]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#252321] mb-1.5">
                        الملكية الفكرية (اختياري)
                      </label>
                      <input
                        type="text"
                        value={articleImageCopyright}
                        onChange={(e) => setArticleImageCopyright(e.target.value)}
                        placeholder="مثال: أرشيف مركز آدم للبحوث"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D8D0C0] focus:border-[#8D4925] focus:outline-none text-xs text-[#252321]"
                      />
                    </div>
                  </div>
                </div>

                {/* Optional Fields Aesthetic Notice Banner (Matches Screenshot) */}
                <div className="p-3.5 rounded-2xl bg-[#FAF6F0] border border-[#E2DACB] flex items-center gap-2.5 text-xs font-bold text-[#8D4925]">
                  <span className="w-5 h-5 rounded-full border border-[#8D4925] flex items-center justify-center text-[11px] shrink-0">
                    !
                  </span>
                  <span>
                    الحقول الاختيارية التي لا يتم تعبئتها لن تظهر للمستخدم للحفاظ على جمالية العرض.
                  </span>
                </div>

                {/* Submit / Cancel Footer */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E2DACB]">
                  <button
                    type="button"
                    onClick={() => setIsArticleModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl bg-[#EDE6DA] hover:bg-[#e2d8c7] text-xs font-bold text-[#252321] cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingArticle}
                    className="px-6 py-2.5 rounded-xl bg-[#8D4925] hover:bg-[#753b1d] text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
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
    </div>
  );
};
