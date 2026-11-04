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

export type AdminModuleTab =
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
        'adam_tree_management',
        'direct_search_inspection',
        'orders_support',
        'knowledge_cms',
        'executive_reports',
      ];
    case 'مدير البحوث':
      return [
        'research_studio',
        'adam_tree_management',
        'direct_search_inspection',
      ];
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
      label: 'إدارة المستخدمين',
      icon: <Users className="w-4 h-4" />,
      badge: staffList.length,
    },
    {
      id: 'research_studio',
      label: 'إدارة البحوث',
      icon: <BookOpen className="w-4 h-4" />,
      badge: researchTicketsCount,
    },
    {
      id: 'adam_tree_management',
      label: 'إدارة شجرة آدم',
      icon: (
        <img
          src="/assets/aistudio/Adam-Ancestral-Tree-Logo.209224b_dd7396cf.png"
          alt="شجرة آدم"
          className="w-5 h-5 rounded-full object-contain bg-white/90 p-0.5 shrink-0"
        />
      ),
      badge: '474,949',
    },
    {
      id: 'direct_search_inspection',
      label: 'البحث والفحص',
      icon: <Search className="w-4 h-4" />,
    },
    {
      id: 'orders_support',
      label: 'إدارة الطلبات وخدمة العملاء',
      icon: <HeadphonesIcon className="w-4 h-4" />,
      badge: orders.length,
    },
    {
      id: 'knowledge_cms',
      label: 'إدارة تحرير المركز المعرفي',
      icon: <FileText className="w-4 h-4" />,
      badge: knowledgeArticles.length,
    },
    {
      id: 'executive_reports',
      label: 'التقارير',
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
                    إدارة المستخدمين وصلاحيات الفريق
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#14110D] hover:bg-[#2A231B] text-[#C5A059] text-xs font-bold cursor-pointer transition shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>إضافة عضو فريق جديد</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-[#F9F6F0] border-b border-[#E2DACB] text-[11px] font-bold text-[#6E6456]">
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
                                className="px-2.5 py-1 rounded-lg border border-[#D8D0C0] hover:bg-[#F4F1EA] text-[11px] font-bold text-[#14110D] cursor-pointer"
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
            PANEL 2: أقسام البحوث الثلاثة (إدارة البحوث / إدارة شجرة آدم / البحث والفحص)
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
                              <div className="w-20 aspect-video rounded-lg overflow-hidden bg-[#252321] border border-[#B98A78]/40 shrink-0">
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
              سيتم تسجيل الحساب مباشرة في{' '}
              <span className="font-bold text-[#14110D]">
                Firebase Authentication
              </span>{' '}
              وقاعدة بيانات{' '}
              <span className="font-bold text-[#14110D]">Firestore</span>، وإرسال دعوة
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
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F9F6F0] border border-[#E2DACB] text-xs font-bold text-[#14110D]"
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
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F9F6F0] border border-[#E2DACB] text-xs text-[#14110D]"
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
                  onClick={() => {
                    setAddStaffError(null);
                    setShowAddStaffModal(false);
                  }}
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
