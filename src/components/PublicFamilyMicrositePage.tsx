import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  GitBranch,
  Globe,
  Heart,
  HelpCircle,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  Mic,
  Pause,
  Pin,
  Play,
  PlusCircle,
  QrCode,
  Scroll,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import {
  COMMERCIAL_LINEAGE_PAYWALL_TEASER_AR,
  EnrichmentRequestType,
  ModuleVisibility,
  PublicMicrositeData,
  addBlessingToFamilyNews,
  addReplyToGuidedMajlisTopic,
  buildDefaultCmsModules,
  fetchPublishedMicrositeBySlug,
  incrementElderMemorialPrayer,
  submitEventRsvpOnMicrosite,
  submitSiteAccessRequest,
  submitTreeEnrichmentRequest,
  submitVaultPhotoFaceIdentification,
} from '../services/priority4Service';
import { processMediaFileForUpload } from '../utils/mediaPipeline';
import { RoyalQrInvitationModal } from './RoyalQrInvitationModal';

interface PublicFamilyMicrositePageProps {
  siteSlug: string;
  previewData?: PublicMicrositeData | null;
  viewerEmail?: string;
  isOwnerPreview?: boolean;
  onExitToMainApp: () => void;
  onStartOwnLineageSearch?: () => void;
}

const SESSION_AUTHORIZED_EMAIL_KEY = 'juthori_microsite_circle_email_v1';

export const PublicFamilyMicrositePage: React.FC<
  PublicFamilyMicrositePageProps
> = ({
  siteSlug,
  previewData,
  viewerEmail,
  isOwnerPreview = false,
  onExitToMainApp,
  onStartOwnLineageSearch,
}) => {
  const [siteData, setSiteData] = useState<PublicMicrositeData | null>(
    previewData || null
  );
  const [loading, setLoading] = useState<boolean>(!previewData);
  const [showQrModal, setShowQrModal] = useState(false);

  // Visitor Circle Verification State
  const [circleEmailInput, setCircleEmailInput] = useState<string>(() => {
    if (viewerEmail) return viewerEmail.trim().toLowerCase();
    if (typeof window !== 'undefined') {
      return (
        window.sessionStorage.getItem(SESSION_AUTHORIZED_EMAIL_KEY) || ''
      ).toLowerCase();
    }
    return '';
  });
  const [activeCircleEmail, setActiveCircleEmail] = useState<string>(() => {
    if (viewerEmail) return viewerEmail.trim().toLowerCase();
    if (typeof window !== 'undefined') {
      return (
        window.sessionStorage.getItem(SESSION_AUTHORIZED_EMAIL_KEY) || ''
      ).toLowerCase();
    }
    return '';
  });
  const [circleVerifyFeedback, setCircleVerifyFeedback] = useState<string | null>(
    null
  );

  // Private Whitelist Access Request Form
  const [accessReqName, setAccessReqName] = useState('');
  const [accessReqEmail, setAccessReqEmail] = useState('');
  const [accessReqKinship, setAccessReqKinship] = useState('');
  const [accessReqSent, setAccessReqSent] = useState(false);
  const [accessReqBusy, setAccessReqBusy] = useState(false);

  // Enrichment Proposal Modal State
  const [showEnrichmentModal, setShowEnrichmentModal] = useState(false);
  const [enrType, setEnrType] =
    useState<EnrichmentRequestType>('ADD_TREE_MEMBER');
  const [enrRequesterName, setEnrRequesterName] = useState('');
  const [enrRequesterEmail, setEnrRequesterEmail] = useState(
    viewerEmail || activeCircleEmail || ''
  );
  const [enrKinship, setEnrKinship] = useState('');
  const [enrTargetPersonId, setEnrTargetPersonId] = useState('');
  const [enrProposedFirstName, setEnrProposedFirstName] = useState('');
  const [enrProposedGender, setEnrProposedGender] = useState<'male' | 'female'>(
    'male'
  );
  const [enrProposedBirthYear, setEnrProposedBirthYear] = useState('');
  const [enrProposedBirthPlace, setEnrProposedBirthPlace] = useState('');
  const [enrNotes, setEnrNotes] = useState('');
  const [enrMediaTitle, setEnrMediaTitle] = useState('');
  const [enrMediaOccasion, setEnrMediaOccasion] = useState('');
  const [enrMediaDataUrl, setEnrMediaDataUrl] = useState('');
  const [enrSubmitting, setEnrSubmitting] = useState(false);
  const [enrSuccessMessage, setEnrSuccessMessage] = useState<string | null>(
    null
  );

  // Interactive Modules Local Input States
  const [blessingInputs, setBlessingInputs] = useState<Record<string, string>>(
    {}
  );
  const [openBlessingId, setOpenBlessingId] = useState<string | null>(null);

  const [rsvpOpenEventId, setRsvpOpenEventId] = useState<string | null>(null);
  const [rsvpName, setRsvpName] = useState('');
  const [rsvpStatus, setRsvpStatus] = useState<'attending' | 'apologizing'>(
    'attending'
  );
  const [rsvpCompanions, setRsvpCompanions] = useState<number>(0);

  const [faceIdOpenItemId, setFaceIdOpenItemId] = useState<string | null>(null);
  const [faceIdSenderName, setFaceIdSenderName] = useState('');
  const [faceIdNote, setFaceIdNote] = useState('');

  const [majlisReplyInputs, setMajlisReplyInputs] = useState<
    Record<string, { name: string; body: string }>
  >({});

  // Oral Heritage Audio Player
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);

  // Live ticker for countdowns (Events & Time Capsule)
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (previewData) {
      setSiteData(previewData);
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    fetchPublishedMicrositeBySlug(siteSlug)
      .then((res) => {
        if (mounted) {
          setSiteData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [siteSlug, previewData]);

  useEffect(() => {
    if (viewerEmail) {
      const clean = viewerEmail.trim().toLowerCase();
      setActiveCircleEmail(clean);
      setCircleEmailInput(clean);
    }
  }, [viewerEmail]);

  const isAuthorizedFamilyCircle = useMemo(() => {
    if (isOwnerPreview || Boolean(previewData)) return true;
    if (!siteData || !activeCircleEmail) return false;
    const list = (siteData.whitelistedEmails || []).map((e) =>
      e.trim().toLowerCase()
    );
    return list.includes(activeCircleEmail.trim().toLowerCase());
  }, [isOwnerPreview, previewData, siteData, activeCircleEmail]);

  const canRenderVisibility = (vis?: ModuleVisibility): boolean => {
    const effective = vis || 'PUBLIC';
    if (effective === 'HIDDEN') return false;
    if (effective === 'FAMILY_ONLY') return isAuthorizedFamilyCircle;
    return true;
  };

  const handleVerifyCircleEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteData) return;
    const candidate = circleEmailInput.trim().toLowerCase();
    if (!candidate) return;
    const allowed = (siteData.whitelistedEmails || [])
      .map((x) => x.trim().toLowerCase())
      .includes(candidate);
    if (allowed) {
      setActiveCircleEmail(candidate);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(SESSION_AUTHORIZED_EMAIL_KEY, candidate);
      }
      setCircleVerifyFeedback(
        'مرحباً بك في دائرة الأسرة! تم فتح كافة الأقسام العائلية الخاصة لك ✓'
      );
    } else {
      setCircleVerifyFeedback(
        'هذا البريد غير مدرج حالياً في دائرة العائلة المصرّح لها. يمكنك إرسال طلب استئذان لأمين السجل أدناه.'
      );
    }
  };

  const handleRequestWhitelistAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteData || !accessReqName.trim() || !accessReqEmail.trim()) return;
    setAccessReqBusy(true);
    try {
      await submitSiteAccessRequest({
        siteSlug: siteData.siteSlug,
        ownerId: siteData.ownerId,
        familyName: siteData.familyName,
        visitorName: accessReqName,
        visitorEmail: accessReqEmail,
        kinshipNote: accessReqKinship,
      });
      setAccessReqSent(true);
    } finally {
      setAccessReqBusy(false);
    }
  };

  const handleEnrichmentMediaUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const processed = await processMediaFileForUpload(file, 'vault_photo');
    setEnrMediaDataUrl(processed.thumbnailDataUrl || processed.mainDataUrl);
  };

  const handleSubmitEnrichment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteData || !enrRequesterName.trim()) return;
    setEnrSubmitting(true);
    try {
      const targetNode = (siteData.publishedTreeMembers || []).find(
        (m) => m.id === enrTargetPersonId
      );
      await submitTreeEnrichmentRequest({
        siteSlug: siteData.siteSlug,
        ownerId: siteData.ownerId,
        familyName: siteData.familyName,
        requesterName: enrRequesterName,
        requesterEmail: enrRequesterEmail || activeCircleEmail,
        kinshipRelation: enrKinship,
        requestType: enrType,
        targetPersonId: enrTargetPersonId || undefined,
        targetPersonName: targetNode?.displayName,
        proposedFirstName: enrProposedFirstName,
        proposedGender: enrProposedGender,
        proposedBirthYear: enrProposedBirthYear,
        proposedBirthPlace: enrProposedBirthPlace,
        proposedNotes: enrNotes,
        mediaTitle: enrMediaTitle,
        mediaDateOrOccasion: enrMediaOccasion,
        mediaDataOrUrl: enrMediaDataUrl || undefined,
        mediaType: 'photo',
      });
      setEnrSuccessMessage(
        'تم رفع مقترح الإثراء إلى صندوق أمين سجل الأسرة بنجاح! سيظهر تلقائياً في البوابة فور اعتماده ✦'
      );
      setEnrProposedFirstName('');
      setEnrNotes('');
      setEnrMediaTitle('');
      setEnrMediaDataUrl('');
    } finally {
      setEnrSubmitting(false);
    }
  };

  const handleTogglePlayClip = (clipId: string, src?: string) => {
    if (!src) return;
    if (playingClipId === clipId) {
      audioElementRef.current?.pause();
      setPlayingClipId(null);
      return;
    }
    if (audioElementRef.current) {
      audioElementRef.current.src = src;
      audioElementRef.current.play().catch(() => {});
      setPlayingClipId(clipId);
    }
  };

  const formatCountdownLabel = (isoDate: string): { expired: boolean; text: string } => {
    const targetMs = new Date(isoDate).getTime();
    if (Number.isNaN(targetMs)) {
      return { expired: false, text: isoDate };
    }
    const diff = targetMs - nowTick;
    if (diff <= 0) {
      return { expired: true, text: 'حان الموعد / متاح الآن' };
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    return {
      expired: false,
      text: `متبقٍّ ${days} يوم و ${hours} ساعة`,
    };
  };

  if (loading) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[#F7F2E9] flex flex-col items-center justify-center p-6 text-center"
      >
        <Loader2 className="w-9 h-9 text-[#D8755B] animate-spin mb-3" />
        <p className="text-sm font-display font-bold text-[#252321]">
          جاري فتح البوابة العائلية الرسمية...
        </p>
      </div>
    );
  }

  if (!siteData) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[#F7F2E9] flex flex-col items-center justify-center p-6 text-center"
      >
        <div className="max-w-md rounded-2xl bg-white border border-[#B98A78]/45 p-8 space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/40 flex items-center justify-center mx-auto">
            <Globe className="w-6 h-6 text-[#8D4925]" />
          </div>
          <h1 className="text-xl font-display font-bold text-[#252321]">
            هذه البوابة العائلية غير منشورة حالياً
          </h1>
          <p className="text-sm text-[#252321]/70 leading-relaxed">
            المعرّف <span className="font-mono font-semibold">Juthori.com/{siteSlug}</span>{' '}
            إما متاح للحجز لأمين سجل جديد أو أن مالكه أوقف نشره العام مؤقتاً.
          </p>
          <button
            type="button"
            onClick={onStartOwnLineageSearch || onExitToMainApp}
            className="w-full py-2.5 px-5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-sm font-display font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span>افحص نسب عائلتك وأنشئ بوابتك عبر جذوري</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const activeTheme = siteData.themeId || 'golden_parchment';

  // PRIVATE_WHITELIST Gate for unauthorized visitors
  if (
    siteData.siteAccessMode === 'PRIVATE_WHITELIST' &&
    !isAuthorizedFamilyCircle
  ) {
    return (
      <div
        dir="rtl"
        data-family-site-theme={activeTheme}
        className="min-h-screen fs-canvas flex flex-col justify-between"
      >
        <header className="border-b fs-border fs-surface px-4 sm:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Lock className="w-4 h-4 fs-accent-text" />
            <span>بوابة عائلية خاصة · الدخول بالدعوة المعتمدة</span>
          </div>
          <button
            type="button"
            onClick={onExitToMainApp}
            className="text-xs font-semibold fs-accent-text hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>منصة جذوري الرئيسية</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </header>

        <main className="max-w-xl mx-auto w-full px-4 py-12 space-y-6">
          <div className="rounded-2xl fs-surface border fs-border p-6 sm:p-8 space-y-5 shadow-sm">
            <div className="text-center space-y-2">
              <div className="text-xs font-bold fs-accent-text">
                {siteData.familyEmblemTag || `ديوان أسرة ${siteData.familyName}`}
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold">
                بوابة أسرة {siteData.familyName} الخاصة
              </h1>
              <p className="text-xs sm:text-sm fs-muted leading-relaxed">
                خصّص أمين سجل الأسرة هذه البوابة لأفراد دائرة العائلة والمدعوين فقط حفاظاً على الخصوصية العائلية.
              </p>
            </div>

            {/* Verify Invited Email */}
            <form
              onSubmit={handleVerifyCircleEmail}
              className="rounded-xl fs-muted-surface border fs-border p-4 space-y-3"
            >
              <label className="block text-xs font-bold">
                هل وصلتك دعوة من أمين السجل؟ أدخل بريدك الإلكتروني للدخول الفوري:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  dir="ltr"
                  required
                  value={circleEmailInput}
                  onChange={(e) => setCircleEmailInput(e.target.value)}
                  placeholder="name@example.com"
                  className="flex-1 px-3.5 py-2 rounded-xl bg-white/90 text-[#252321] border fs-border text-xs focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl fs-accent-bg text-xs font-display font-bold cursor-pointer shrink-0"
                >
                  تحقق ودخول البوابة
                </button>
              </div>
              {circleVerifyFeedback && (
                <p className="text-xs fs-accent-text font-semibold">
                  {circleVerifyFeedback}
                </p>
              )}
            </form>

            {/* Polite Access Request Form */}
            <div className="border-t fs-border pt-4">
              {accessReqSent ? (
                <div className="rounded-xl fs-muted-surface border fs-border p-4 text-center space-y-1.5">
                  <CheckCircle2 className="w-6 h-6 fs-accent-text mx-auto" />
                  <div className="text-sm font-display font-bold">
                    تم رفع طلب الاستئذان إلى أمين سجل أسرة {siteData.familyName}
                  </div>
                  <p className="text-xs fs-muted">
                    ستصلك رسالة دعوة رسمية عبر البريد الإلكتروني فور اعتماد انضمامك للدائرة العائلية.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRequestWhitelistAccess} className="space-y-3">
                  <div className="text-xs font-bold">
                    أو تقدّم بطلب استئذان انضمام لبوابة الأسرة:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      required
                      value={accessReqName}
                      onChange={(e) => setAccessReqName(e.target.value)}
                      placeholder="الاسم الثلاثي الكريم"
                      className="px-3 py-2 rounded-xl bg-white/90 text-[#252321] border fs-border text-xs"
                    />
                    <input
                      type="email"
                      dir="ltr"
                      required
                      value={accessReqEmail}
                      onChange={(e) => setAccessReqEmail(e.target.value)}
                      placeholder="البريد الإلكتروني"
                      className="px-3 py-2 rounded-xl bg-white/90 text-[#252321] border fs-border text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    value={accessReqKinship}
                    onChange={(e) => setAccessReqKinship(e.target.value)}
                    placeholder="صلة القرابة أو الفرع العائلي (اختياري)"
                    className="w-full px-3 py-2 rounded-xl bg-white/90 text-[#252321] border fs-border text-xs"
                  />
                  <button
                    type="submit"
                    disabled={accessReqBusy}
                    className="w-full py-2.5 rounded-xl border fs-border fs-muted-surface hover:opacity-90 text-xs font-display font-bold cursor-pointer"
                  >
                    {accessReqBusy
                      ? 'جاري إرسال طلب الاستئذان...'
                      : 'إرسال طلب استئذان لأمين السجل'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </main>

        <footer className="py-5 text-center text-xs fs-muted border-t fs-border">
          بوابة عائلية موثقة عبر منصة «جذوري» لحفظ الأنساب العربية · Juthori.com/{siteData.siteSlug}
        </footer>
      </div>
    );
  }

  const modules =
    siteData.cmsModules ||
    buildDefaultCmsModules({
      matched: true,
      engineSource: 'neo4j_verified_graph',
      clientName: '',
      fatherName: '',
      grandfatherName: '',
      familyName: siteData.familyName,
      familyCode: '',
      originCountry: siteData.originCountry || 'السعودية',
      originRegion: siteData.originRegion || '',
      rootBranchName: '',
      rootBranchCode: '',
      rootTribeName: '',
      rootTribeCode: '',
      rootSummaryLabel: '',
      upperAncestors: [],
      adamSpineNodes: [],
      capsules: [],
      requiresBlindDisambiguation: false,
      disambiguationOptions: [],
      verifiedSourceCitation: '',
      secondarySources: [],
      historicalRegion: '',
      conflictingNarrativesNote: '',
      confidenceLabel: '',
      recommendedInitialState: 0 as never,
    });

  const currentCalendarMonth = new Date().getMonth() + 1;
  const thisMonthStories = (modules.storiesModule.items || []).filter(
    (s) => s.historicalMonth === currentCalendarMonth
  );

  const hasHiddenFamilyOnlyModules =
    !isAuthorizedFamilyCircle &&
    (siteData.privacyConfig.bioVisibility === 'FAMILY_ONLY' ||
      siteData.privacyConfig.treeVisibility === 'FAMILY_ONLY' ||
      siteData.privacyConfig.vaultVisibility === 'FAMILY_ONLY' ||
      modules.eventsModule.visibility === 'FAMILY_ONLY' ||
      modules.oralHeritageModule.visibility === 'FAMILY_ONLY' ||
      modules.professionsModule.visibility === 'FAMILY_ONLY' ||
      modules.majlisAndGuardiansModule.visibility === 'FAMILY_ONLY');

  const treeMembers = siteData.publishedTreeMembers || [];
  const vaultItems = siteData.publishedVaultItems || [];
  const metrics = siteData.treeMetrics;
  const guardians = siteData.guardiansOfMemory || [];

  return (
    <div
      dir="rtl"
      data-family-site-theme={activeTheme}
      className="min-h-screen fs-canvas transition-colors"
    >
      <audio
        ref={audioElementRef}
        onEnded={() => setPlayingClipId(null)}
        className="hidden"
      />

      {/* Top Official Institutional Ribbon */}
      <header className="border-b fs-border fs-surface sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl fs-hero flex items-center justify-center font-display font-bold text-sm">
              ج
            </div>
            <div>
              <div className="text-sm font-display font-bold flex items-center gap-1.5">
                <span>ديوان أسرة {siteData.familyName}</span>
                {siteData.isRegistrarCertified && (
                  <ShieldCheck className="w-4 h-4 fs-accent-text" />
                )}
              </div>
              <div className="text-[11px] fs-muted font-mono" dir="ltr">
                Juthori.com/{siteData.siteSlug}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="px-3.5 py-2 rounded-xl border fs-border fs-muted-surface text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90"
            >
              <QrCode className="w-3.5 h-3.5 fs-accent-text" />
              <span>بطاقة الدعوة و QR</span>
            </button>

            <button
              type="button"
              onClick={onStartOwnLineageSearch || onExitToMainApp}
              className="px-3.5 py-2 rounded-xl fs-accent-bg text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95"
            >
              <span>افحص نسبك في جذوري</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-8">
        {/* 1. HERO, EMBLEM TAG & FAMILY BIO */}
        <section className="rounded-2xl fs-hero p-6 sm:p-10 shadow-md relative overflow-hidden">
          <div className="max-w-3xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 text-xs font-semibold opacity-90 border-b border-current/25 pb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {siteData.familyEmblemTag ||
                  siteData.membershipLabel ||
                  `ديوان وسجل أسرة ${siteData.familyName}`}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-display font-bold leading-tight">
              {canRenderVisibility(siteData.privacyConfig.bioVisibility) &&
              siteData.bioTitle
                ? siteData.bioTitle
                : `البوابة الرقمية الرسمية لأسرة ${siteData.familyName}`}
            </h1>

            {canRenderVisibility(siteData.privacyConfig.bioVisibility) &&
              siteData.bioDescription && (
                <p className="text-sm sm:text-base opacity-90 leading-relaxed whitespace-pre-line">
                  {siteData.bioDescription}
                </p>
              )}

            <div className="pt-2 flex flex-wrap items-center gap-5 text-xs opacity-85">
              {siteData.originCountry && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>
                    الموطن المسجل: {siteData.originCountry}
                    {siteData.originRegion ? ` — ${siteData.originRegion}` : ''}
                  </span>
                </span>
              )}
              {siteData.ownerDisplayName && (
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>إشراف أمين السجل: {siteData.ownerDisplayName}</span>
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Subtle Family Circle Unlock Bar when on a PUBLIC site with FAMILY_ONLY sections */}
        {hasHiddenFamilyOnlyModules && (
          <section className="rounded-2xl fs-surface border fs-border p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-display font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 fs-accent-text" />
                <span>هل أنت من أفراد دائرة أسرة {siteData.familyName}؟</span>
              </div>
              <p className="text-xs fs-muted">
                أدخل بريدك الإلكتروني المدعو لفتح الأقسام العائلية الخاصة (المناسبات، مجلس الحوار، والتفاصيل العائلية).
              </p>
              {circleVerifyFeedback && (
                <p className="text-xs fs-accent-text font-semibold">
                  {circleVerifyFeedback}
                </p>
              )}
            </div>
            <form
              onSubmit={handleVerifyCircleEmail}
              className="flex items-center gap-2 shrink-0"
            >
              <input
                type="email"
                dir="ltr"
                value={circleEmailInput}
                onChange={(e) => setCircleEmailInput(e.target.value)}
                placeholder="بريدك المدعو..."
                className="px-3 py-2 rounded-xl bg-white/90 text-[#252321] border fs-border text-xs w-48 sm:w-56"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl fs-accent-bg text-xs font-display font-bold cursor-pointer"
              >
                فتح الأقسام العائلية
              </button>
            </form>
          </section>
        )}

        {/* 2. CONTEMPORARY FAMILY TREE MIRROR + STRICT COMMERCIAL PAYWALL TEASER */}
        {siteData.privacyConfig.showFamilyTree &&
          canRenderVisibility(siteData.privacyConfig.treeVisibility) && (
            <section className="rounded-2xl fs-surface border fs-border p-6 sm:p-8 space-y-6">
              {/* COMMERCIAL PAYWALL TEASER (Zero upper lineage spine or book sources leaked!) */}
              <div className="rounded-xl fs-muted-surface border fs-border p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl fs-hero flex items-center justify-center shrink-0 mt-0.5">
                    <Scroll className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold fs-accent-text">
                      التوثيق التاريخي المرجعي عبر منصة جذوري
                    </div>
                    <p className="text-xs sm:text-sm font-display font-bold leading-relaxed">
                      «{COMMERCIAL_LINEAGE_PAYWALL_TEASER_AR}»
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onStartOwnLineageSearch || onExitToMainApp}
                  className="px-4 py-2.5 rounded-xl fs-accent-bg text-xs font-display font-bold inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer hover:opacity-95"
                >
                  <span>افحص واكشف عمود نسبك الخاص</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tree Header + Enrichment CTA */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b fs-border pb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-display font-bold flex items-center gap-2">
                    <GitBranch className="w-5 h-5 fs-accent-text" />
                    <span>مرآة شجرة أسرة {siteData.familyName} المعاصرة</span>
                  </h2>
                  <p className="text-xs fs-muted mt-1">
                    نسخة عرض معاصرة خاضعة لمصفوفة خصوصية الأسرة بإشراف أمين السجل ({treeMembers.length} فرداً معروضاً)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEnrSuccessMessage(null);
                    setShowEnrichmentModal(true);
                  }}
                  className="px-4 py-2.5 rounded-xl fs-accent-bg text-xs font-display font-bold inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>اقترح إثراءً / إضافة فرع أو مولود أو صورة لهذه الشجرة</span>
                </button>
              </div>

              {/* Contemporary Tree Cards */}
              {treeMembers.length === 0 ? (
                <div className="rounded-xl fs-muted-surface border fs-border p-6 text-center text-xs fs-muted">
                  يجري إعداد الفروع المعاصرة لشجرة الأسرة من قِبل أمين السجل. يمكنك المساهمة باقتراح إضافة فرعك أو أبنائك عبر زر «اقترح إثراءً».
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {treeMembers.map((member) => {
                    const effectiveName =
                      isAuthorizedFamilyCircle && member.familyCircleDisplayName
                        ? member.familyCircleDisplayName
                        : member.displayName;
                    return (
                      <div
                        key={member.id}
                        className="rounded-xl fs-muted-surface border fs-border p-4 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] fs-muted">
                          <span>{member.relationLabel}</span>
                          <span>الجيل {member.generationLevel}</span>
                        </div>
                        <div className="text-sm font-display font-bold flex items-center gap-1.5">
                          {member.isProtectedLiving && (
                            <Lock className="w-3.5 h-3.5 fs-accent-text shrink-0" />
                          )}
                          <span>{effectiveName}</span>
                        </div>
                        <div className="text-xs fs-muted flex flex-wrap items-center gap-2">
                          <span>
                            {member.isDeceased
                              ? `رحمه الله${
                                  member.deathYear ? ` (${member.deathYear})` : ''
                                }`
                              : member.birthYear
                              ? `مواليد ${member.birthYear}`
                              : 'حفظه الله'}
                          </span>
                          {member.birthPlace && <span>· {member.birthPlace}</span>}
                        </div>
                        {member.bioSnippet && (
                          <p className="text-[11px] fs-muted pt-1 border-t fs-border leading-relaxed">
                            {member.bioSnippet}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

        {/* 3. FAMILY NEWS & INTERACTIVE BLESSINGS LEDGER («بارك له») */}
        {modules.newsModule.enabled &&
          canRenderVisibility(modules.newsModule.visibility) &&
          modules.newsModule.items.length > 0 && (
            <section className="rounded-2xl fs-surface border fs-border p-6 sm:p-8 space-y-5">
              <div className="border-b fs-border pb-3">
                <h2 className="text-lg sm:text-xl font-display font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 fs-accent-text" />
                  <span>ديوان أخبار الأسرة وسجل التبريكات</span>
                </h2>
                <p className="text-xs fs-muted mt-0.5">
                  أحدث بشائر الأسرة من مواليد وتخرج وزواج مع إمكانية تسجيل تهنئتك مباشرةً
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modules.newsModule.items.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl fs-muted-surface border fs-border p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className="fs-accent-text">{item.category}</span>
                        <span className="fs-muted">{item.dateLabel}</span>
                      </div>
                      <h3 className="text-base font-display font-bold">
                        {item.title}
                      </h3>
                      <p className="text-xs fs-muted leading-relaxed">
                        {item.summary}
                      </p>
                    </div>

                    <div className="pt-3 border-t fs-border space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold fs-muted">
                          المباركون ({(item.blessings || []).length})
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenBlessingId(
                              openBlessingId === item.id ? null : item.id
                            )
                          }
                          className="px-3 py-1.5 rounded-lg fs-accent-bg text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Heart className="w-3.5 h-3.5" />
                          <span>بارك له</span>
                        </button>
                      </div>

                      {(item.blessings || []).length > 0 && (
                        <div className="text-[11px] fs-muted leading-relaxed">
                          بارك له:{' '}
                          {item.blessings
                            .slice(-6)
                            .map((b) => b.senderName)
                            .join(' · ')}
                        </div>
                      )}

                      {openBlessingId === item.id && (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            value={blessingInputs[item.id] || ''}
                            onChange={(e) =>
                              setBlessingInputs((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            placeholder="اكتب اسمك الكريم للتهنئة..."
                            className="flex-1 px-3 py-1.5 rounded-lg bg-white/95 text-[#252321] border fs-border text-xs"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const sender = (blessingInputs[item.id] || '').trim();
                              if (!sender) return;
                              const updated = await addBlessingToFamilyNews({
                                siteSlug: siteData.siteSlug,
                                newsId: item.id,
                                senderName: sender,
                              });
                              if (updated) setSiteData(updated);
                              setBlessingInputs((prev) => ({
                                ...prev,
                                [item.id]: '',
                              }));
                              setOpenBlessingId(null);
                            }}
                            className="px-3 py-1.5 rounded-lg fs-accent-bg text-xs font-bold cursor-pointer"
                          >
                            إرسال التبريك
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

        {/* 4. UPCOMING EVENTS + COUNTDOWN + RSVP */}
        {modules.eventsModule.enabled &&
          canRenderVisibility(modules.eventsModule.visibility) &&
          modules.eventsModule.items.length > 0 && (
            <section className="rounded-2xl fs-surface border fs-border p-6 sm:p-8 space-y-5">
              <div className="border-b fs-border pb-3">
                <h2 className="text-lg sm:text-xl font-display font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5 fs-accent-text" />
                  <span>المناسبات والدعوات القادمة</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modules.eventsModule.items.map((ev) => {
                  const cd = formatCountdownLabel(ev.eventDateIso);
                  const attendingCount = (ev.rsvps || [])
                    .filter((r) => r.status === 'attending')
                    .reduce((acc, r) => acc + 1 + (r.companionsCount || 0), 0);
                  return (
                    <div
                      key={ev.id}
                      className="rounded-xl fs-muted-surface border fs-border p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="fs-accent-text flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{cd.text}</span>
                        </span>
                        <span className="fs-muted font-mono">
                          {ev.eventDateIso}
                        </span>
                      </div>
                      <h3 className="text-base font-display font-bold">
                        {ev.title}
                      </h3>
                      <div className="text-xs fs-muted flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 fs-accent-text" />
                        <span>{ev.locationLabel}</span>
                      </div>
                      {ev.hostNote && (
                        <p className="text-xs fs-muted leading-relaxed">
                          {ev.hostNote}
                        </p>
                      )}

                      <div className="pt-3 border-t fs-border flex items-center justify-between">
                        <span className="text-xs fs-muted">
                          مؤكدو الحضور: <strong>{attendingCount}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRsvpOpenEventId(
                              rsvpOpenEventId === ev.id ? null : ev.id
                            )
                          }
                          className="px-3.5 py-1.5 rounded-lg fs-accent-bg text-xs font-display font-bold cursor-pointer"
                        >
                          تأكيد الحضور (RSVP)
                        </button>
                      </div>

                      {rsvpOpenEventId === ev.id && (
                        <div className="pt-2 space-y-2 border-t fs-border">
                          <input
                            type="text"
                            value={rsvpName}
                            onChange={(e) => setRsvpName(e.target.value)}
                            placeholder="الاسم الكريم..."
                            className="w-full px-3 py-1.5 rounded-lg bg-white/95 text-[#252321] border fs-border text-xs"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={rsvpStatus}
                              onChange={(e) =>
                                setRsvpStatus(
                                  e.target.value as 'attending' | 'apologizing'
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-white/95 text-[#252321] border fs-border text-xs"
                            >
                              <option value="attending">يشرفني الحضور ✓</option>
                              <option value="apologizing">أعتذر عن الحضور</option>
                            </select>
                            <input
                              type="number"
                              min={0}
                              max={10}
                              value={rsvpCompanions}
                              onChange={(e) =>
                                setRsvpCompanions(Number(e.target.value || 0))
                              }
                              placeholder="عدد المرافقين"
                              className="px-2.5 py-1.5 rounded-lg bg-white/95 text-[#252321] border fs-border text-xs"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!rsvpName.trim()) return;
                              const updated = await submitEventRsvpOnMicrosite({
                                siteSlug: siteData.siteSlug,
                                eventId: ev.id,
                                attendeeName: rsvpName,
                                status: rsvpStatus,
                                companionsCount: rsvpCompanions,
                              });
                              if (updated) setSiteData(updated);
                              setRsvpName('');
                              setRsvpOpenEventId(null);
                            }}
                            className="w-full py-1.5 rounded-lg fs-accent-bg text-xs font-bold cursor-pointer"
                          >
                            حفظ الرد
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

        {/* 5. STORIES & ARTICLES + «حدث في مثل هذا الشهر» */}
        {modules.storiesModule.enabled &&
          canRenderVisibility(modules.storiesModule.visibility) &&
          modules.storiesModule.items.length > 0 && (
            <section className="rounded-2xl fs-surface border fs-border p-6 sm:p-8 space-y-5">
              <div className="border-b fs-border pb-3">
                <h2 className="text-lg sm:text-xl font-display font-bold flex items-center gap-2">
                  <BookOpen className="w-5 h-5 fs-accent-text" />
                  <span>قصص ومآثر الآباء والأجداد</span>
                </h2>
              </div>

              {thisMonthStories.length > 0 && (
                <div className="rounded-xl fs-hero p-4 space-y-1.5">
                  <div className="text-[11px] font-bold opacity-85">
                    ✦ حدث في مثل هذا الشهر في تاريخ أسرتنا
                  </div>
                  <div className="text-sm font-display font-bold">
                    {thisMonthStories[0].title} ({thisMonthStories[0].eraOrYearLabel})
                  </div>
                  <p className="text-xs opacity-90 leading-relaxed">
                    {thisMonthStories[0].body}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modules.storiesModule.items.map((st) => (
                  <article
                    key={st.id}
                    className="rounded-xl fs-muted-surface border fs-border p-5 space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] fs-muted">
                      <span>{st.eraOrYearLabel}</span>
                      {st.authorLabel && <span>تدوين: {st.authorLabel}</span>}
                    </div>
                    <h3 className="text-base font-display font-bold">
                      {st.title}
                    </h3>
                    <p className="text-xs fs-muted leading-relaxed whitespace-pre-line">
                      {st.body}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}

        {/* 6. HONOR ROLL & FAMILY NOTABLES */}
        {modules.notablesModule.enabled &&
          canRenderVisibility(modules.notablesModule.visibility) &&
          modules.notablesModule.items.length > 0 && (
            <section className="rounded-2xl fs-surface border fs-border p-6 sm:p-8 space-y-5">
              <div className="border-b fs-border pb-3">
                <h2 className="text-lg sm:text-xl font-display font-bold flex items-center gap-2">
                  <Award className="w-5 h-5 fs-accent-text" />
                  <span>لوحة الشرف وأعلام ورموز الأسرة</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {modules.notablesModule.items.map((notable) => (
                  <div
                    key={notable.id}
                    className="rounded-xl fs-muted-surface border fs-border p-5 space-y-2"
                  >
                    <div className="text-[11px] font-bold fs-accent-text">
                      {notable.roleOrTitle} · {notable.eraLabel}
                    </div>
                    <h3 className="text-base font-display font-bold">
                      {notable.fullName}
                    </h3>
                    <p className="text-xs fs-muted leading-relaxed">
                      {notable.achievementSummary}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

        {/* 7. SELECTED VAULT GALLERY MIRROR + DYNAMIC WATERMARK + «أتعرف من في الصورة؟» */}
        {canRenderVisibility(siteData.privacyConfig.vaultVisibility) &&
          vaultItems.length > 0 && (
            <section className="rounded-2xl fs-surface border fs-border p-6 sm:p-8 space-y-5">
              <div className="border-b fs-border pb-3">
                <h2 className="text-lg sm:text-xl font-display font-bold flex items-center gap-2">
                  <Camera className="w-5 h-5 fs-accent-text" />
                  <span>معرض الصور والوثائق التاريخية المختارة</span>
                </h2>
                <p className="text-xs fs-muted mt-0.5">
                  مقتنيات مختارة بعناية من خزانة الأسرة مع حماية الحقوق بالعلامة المائية الرسمية
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {vaultItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl fs-muted-surface border fs-border overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {item.previewUrl ? (
                        <div className="relative h-48 bg-[#252321]/10 overflow-hidden select-none">
                          <img
                            src={item.previewUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                          {item.watermarkText && (
                            <div
                              dir="ltr"
                              className="absolute inset-x-0 bottom-2 px-3 flex justify-end pointer-events-none"
                            >
                              <span className="px-2 py-0.5 rounded bg-black/50 text-white/90 font-mono text-[10px] tracking-wider">
                                {item.watermarkText}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="h-32 bg-[#252321]/5 flex items-center justify-center">
                          <FileText className="w-8 h-8 fs-accent-text opacity-70" />
                        </div>
                      )}

                      <div className="p-4 space-y-1.5">
                        <div className="text-[11px] font-semibold fs-accent-text">
                          {item.mediaType === 'document'
                            ? 'وثيقة أرشيفية'
                            : 'صورة تاريخية'}
                          {item.dateOrOccasion ? ` · ${item.dateOrOccasion}` : ''}
                        </div>
                        <h3 className="text-sm font-display font-bold">
                          {item.title}
                        </h3>
                        {item.description && (
                          <p className="text-xs fs-muted leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Interactive «أتعرف من في الصورة؟» */}
                    {siteData.privacyConfig.enablePhotoFacePrompt !== false &&
                      item.mediaType === 'photo' && (
                        <div className="px-4 pb-4 pt-2 border-t fs-border space-y-2">
                          <button
                            type="button"
                            onClick={() =>
                              setFaceIdOpenItemId(
                                faceIdOpenItemId === item.id ? null : item.id
                              )
                            }
                            className="text-xs font-bold fs-accent-text hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>أتعرف من في الصورة؟ ساهم بالتعريف</span>
                          </button>

                          {(item.faceIdNotes || []).length > 0 && (
                            <div className="space-y-1 pt-1">
                              {item.faceIdNotes!.slice(-3).map((n) => (
                                <div
                                  key={n.id}
                                  className="text-[11px] fs-muted bg-black/5 rounded-lg px-2.5 py-1.5"
                                >
                                  <strong>{n.senderName}:</strong> {n.note}
                                </div>
                              ))}
                            </div>
                          )}

                          {faceIdOpenItemId === item.id && (
                            <div className="space-y-2 pt-1">
                              <input
                                type="text"
                                value={faceIdSenderName}
                                onChange={(e) =>
                                  setFaceIdSenderName(e.target.value)
                                }
                                placeholder="اسمك الكريم..."
                                className="w-full px-2.5 py-1.5 rounded-lg bg-white/95 text-[#252321] border fs-border text-xs"
                              />
                              <input
                                type="text"
                                value={faceIdNote}
                                onChange={(e) => setFaceIdNote(e.target.value)}
                                placeholder="من يظهر في يمين/وسط الصورة أو مناسبتها؟"
                                className="w-full px-2.5 py-1.5 rounded-lg bg-white/95 text-[#252321] border fs-border text-xs"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!faceIdSenderName.trim() || !faceIdNote.trim())
                                    return;
                                  const updated =
                                    await submitVaultPhotoFaceIdentification({
                                      siteSlug: siteData.siteSlug,
                                      vaultItemId: item.id,
                                      senderName: faceIdSenderName,
                                      note: faceIdNote,
                                    });
                                  if (updated) setSiteData(updated);
                                  setFaceIdNote('');
                                  setFaceIdOpenItemId(null);
                                }}
                                className="w-full py-1.5 rounded-lg fs-accent-bg text-xs font-bold cursor-pointer"
                              >
                                إرسال التعريف
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </section>
          )}

        {/* 8. ORAL HERITAGE CORNER («أصوات خالدة») */}
        {modules.oralHeritageModule.enabled &&
          canRenderVisibility(modules.oralHeritageModule.visibility) &&
          modules.oralHeritageModule.items.length > 0 && (
            <section className="rounded-2xl fs-surface border fs-border p-6 sm:p-8 space-y-5">
              <div className="border-b fs-border pb-3">
                <h2 className="text-lg sm:text-xl font-display font-bold flex items-center gap-2">
                  <Mic className="w-5 h-5 fs-accent-text" />
                  <span>ركن الموروث الشفهي · أصوات خالدة</span>
                </h2>
                <p className="text-xs fs-muted mt-0.5">
                  تسجيلات صوتية نادرة لكبار الأسرة تروي الذكريات والقصائد والوصايا
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modules.oralHeritageModule.items.map((clip) => {
                  const isPlaying = playingClipId === clip.id;
                  return (
                    <div
                      key={clip.id}
                      className="rounded-xl fs-muted-surface border fs-border p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-bold fs-accent-text">
                            بصوت: {clip.speakerName} · {clip.recordedYearLabel}
                          </div>
                          <h3 className="text-sm font-display font-bold mt-0.5">
                            {clip.title}
                          </h3>
                        </div>

                        {clip.audioDataOrUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleTogglePlayClip(clip.id, clip.audioDataOrUrl)
                            }
                            className="w-10 h-10 rounded-xl fs-accent-bg flex items-center justify-center shrink-0 cursor-pointer"
                            aria-label="تشغيل المقطع الصوتي"
                          >
                            {isPlaying ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <Volume2 className="w-5 h-5 fs-muted" />
                        )}
                      </div>
                      <p className="text-xs fs-muted leading-relaxed">
                        «{clip.transcriptExcerpt}»
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

        {/* 9. GEOGRAPHIC ATLAS («ديارنا حول العالم») + «أرقام من شجرتنا» */}
        {modules.atlasAndStatsModule.enabled &&
          canRenderVisibility(modules.atlasAndStatsModule.visibility) && (
            <section className="rounded-2xl fs-surface border fs-border p-6 sm:p-8 space-y-6">
              <div className="border-b fs-border pb-3">
                <h2 className="text-lg sm:text-xl font-display font-bold flex items-center gap-2">
                  <Globe className="w-5 h-5 fs-accent-text" />
                  <span>أطلس الانتشار الجغرافي وأرقام من شجرتنا</span>
                </h2>
                <p className="text-xs fs-muted mt-0.5">
                  توزيع حواضر ومدن تواجد الأسرة وإحصاءات الفروع المعاصرة
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Diyaruna Locations */}
                <div className="lg:col-span-6 space-y-3">
                  <div className="text-xs font-display font-bold fs-accent-text">
                    ديارنا حول العالم (الدول والمدن فقط دون عناوين تفصيلية)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {modules.atlasAndStatsModule.locations.map((loc) => (
                      <div
                        key={loc.id}
                        className="rounded-xl fs-muted-surface border fs-border p-3.5 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-sm font-display font-bold">
                            {loc.city}
                          </div>
                          <div className="text-[11px] fs-muted">{loc.country}</div>
                        </div>
                        <div className="text-left">
                          <div className="text-base font-display font-bold fs-accent-text">
                            {loc.householdsOrMembersCount}
                          </div>
                          <div className="text-[10px] fs-muted">حضور عائلي</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Auto-computed Contemporary Tree Numbers */}
                {modules.atlasAndStatsModule.showAutoTreeNumbers && metrics && (
                  <div className="lg:col-span-6 space-y-3">
                    <div className="text-xs font-display font-bold fs-accent-text">
                      أرقام من شجرتنا المعاصرة (تُحسب تلقائياً)
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl fs-muted-surface border fs-border p-4">
                        <div className="text-2xl font-display font-bold">
                          {metrics.generationsCount}
                        </div>
                        <div className="text-xs fs-muted">
                          عدد الأجيال المعاصرة الموثقة
                        </div>
                      </div>
                      <div className="rounded-xl fs-muted-surface border fs-border p-4">
                        <div className="text-2xl font-display font-bold">
                          {metrics.totalContemporaryMembers}
                        </div>
                        <div className="text-xs fs-muted">
                          إجمالي أفراد الفروع المعاصرة
                        </div>
                      </div>
                    </div>

                    {metrics.topCommonNames.length > 0 && (
                      <div className="rounded-xl fs-muted-surface border fs-border p-3.5 text-xs">
                        <span className="font-bold">أكثر الأسماء تكراراً في الأسرة: </span>
                        <span className="fs-muted">
                          {metrics.topCommonNames
                            .map((n) => `${n.name} (${n.count})`)
                            .join(' · ')}
                        </span>
                      </div>
                    )}

                    {metrics.largestBranches.length > 0 && (
                      <div className="rounded-xl fs-muted-surface border fs-border p-3.5 text-xs">
                        <span className="font-bold">أكبر الفروع المعاصرة: </span>
                        <span className="fs-muted">
                          {metrics.largestBranches
                            .map((b) => `${b.branchLabel} (${b.count})`)
                            .join(' · ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

        {/* 10. FAMILY PROFESSIONS & COMPETENCIES («شبكة أبناء العمومة») */}
        {modules.professionsModule.enabled &&
          canRenderVisibility(modules.professionsModule.visibility) &&
          modules.professionsModule.items.length > 0 && (
            <section className="rounded-2xl fs-surface border fs-border p-6 sm:p-8 space-y-5">
              <div className="border-b fs-border pb-3">
                <h2 className="text-lg sm:text-xl font-display font-bold flex items-center gap-2">
                  <Briefcase className="w-5 h-5 fs-accent-text" />
                  <span>دليل مهن وكفاءات الأسرة · شبكة أبناء العمومة</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {modules.professionsModule.items.map((prof) => (
                  <div
                    key={prof.id}
                    className="rounded-xl fs-muted-surface border fs-border p-4 space-y-1"
                  >
                    <div className="text-[11px] font-bold fs-accent-text">
                      {prof.fieldCategory}
                    </div>
                    <div className="text-sm font-display font-bold">
                      {prof.memberName}
                    </div>
                    <div className="text-xs fs-muted">
                      {prof.specialtyOrProfession}
                    </div>
                    {prof.cityCountryLabel && (
                      <div className="text-[11px] fs-muted pt-1">
                        {prof.cityCountryLabel}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

        {/* 11. MEMORIAL SHRINE («راحلون في القلب») & TIME CAPSULE («كبسولة الزمن العائلية») */}
        {modules.memorialAndCapsuleModule.enabled &&
          canRenderVisibility(modules.memorialAndCapsuleModule.visibility) && (
            <section className="rounded-2xl fs-surface border fs-border p-6 sm:p-8 space-y-6">
              <div className="border-b fs-border pb-3">
                <h2 className="text-lg sm:text-xl font-display font-bold flex items-center gap-2">
                  <Heart className="w-5 h-5 fs-accent-text" />
                  <span>ركن الوفاء · راحلون في القلب وكبسولة الزمن العائلية</span>
                </h2>
              </div>

              {modules.memorialAndCapsuleModule.elders.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {modules.memorialAndCapsuleModule.elders.map((el) => (
                    <div
                      key={el.id}
                      className="rounded-xl fs-muted-surface border fs-border p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-display font-bold">
                          {el.fullName} — رحمه الله
                        </h3>
                        <span className="text-xs fs-muted">
                          {el.passingYearLabel}
                        </span>
                      </div>
                      <p className="text-xs fs-muted leading-relaxed">
                        {el.biographyNote}
                      </p>
                      {el.ongoingCharityTitle && (
                        <div className="text-xs p-2.5 rounded-lg border fs-border">
                          <strong>الوقف / الصدقة الجارية:</strong>{' '}
                          {el.ongoingCharityTitle}{' '}
                          {el.ongoingCharityUrlOrNote
                            ? `(${el.ongoingCharityUrlOrNote})`
                            : ''}
                        </div>
                      )}
                      <div className="pt-2 flex items-center justify-between border-t fs-border">
                        <span className="text-xs fs-muted">
                          دعوات بالرحمة والمغفرة: <strong>{el.prayersCount || 0}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            const updated = await incrementElderMemorialPrayer({
                              siteSlug: siteData.siteSlug,
                              elderId: el.id,
                            });
                            if (updated) setSiteData(updated);
                          }}
                          className="px-3 py-1.5 rounded-lg fs-accent-bg text-xs font-display font-bold cursor-pointer"
                        >
                          اللهم ارحمه واغفر له ({(el.prayersCount || 0) + 1})
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Family Time Capsule */}
              {modules.memorialAndCapsuleModule.timeCapsule?.enabled && (
                <div className="rounded-2xl fs-hero p-6 space-y-3">
                  {(() => {
                    const tc = modules.memorialAndCapsuleModule.timeCapsule;
                    const cd = formatCountdownLabel(tc.unlockDateIso);
                    return (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-bold opacity-85 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5" />
                            <span>كبسولة الزمن العائلية الموصدة</span>
                          </div>
                          <span className="text-xs font-mono opacity-90">
                            تاريخ الفتح المحدد: {tc.unlockDateIso} ({cd.text})
                          </span>
                        </div>
                        <h3 className="text-lg font-display font-bold">
                          {tc.title} — بقلم: {tc.authorElderName}
                        </h3>
                        {cd.expired ? (
                          <p className="text-sm opacity-95 leading-relaxed whitespace-pre-line pt-2 border-t border-current/20">
                            {tc.sealedMessage}
                          </p>
                        ) : (
                          <div className="rounded-xl bg-black/20 p-4 text-xs opacity-90 flex items-center gap-2.5">
                            <Lock className="w-4 h-4 shrink-0" />
                            <span>
                              هذه الرسالة مختومة بختم أمين السجل ولن يُكشف نصها للأحفاد وأفراد الأسرة إلا تلقائياً عند حلول تاريخ ({tc.unlockDateIso}).
                            </span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </section>
          )}

        {/* 12. GUIDED DIALOGUE MAJLIS & TOP 3 «حماة الذاكرة» */}
        {modules.majlisAndGuardiansModule.enabled &&
          canRenderVisibility(modules.majlisAndGuardiansModule.visibility) && (
            <section className="rounded-2xl fs-surface border fs-border p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b fs-border pb-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-display font-bold flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 fs-accent-text" />
                    <span>مجلس الحوار العائلي الموجه وحماة الذاكرة</span>
                  </h2>
                  <p className="text-xs fs-muted mt-0.5">
                    مواضيع حوارية هادفة يطرحها أمين السجل لتدوين ذكريات الأسرة وتكريم المساهمين
                  </p>
                </div>
              </div>

              {/* Top 3 Guardians of Memory Honor Roll */}
              {modules.majlisAndGuardiansModule.showGuardiansHonorRoll &&
                guardians.length > 0 && (
                  <div className="rounded-xl fs-muted-surface border fs-border p-4 space-y-3">
                    <div className="text-xs font-display font-bold fs-accent-text flex items-center gap-1.5">
                      <Award className="w-4 h-4" />
                      <span>لوحة شرف «حماة الذاكرة» (أكثر أبناء الأسرة إثراءً للسجل)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {guardians.slice(0, 3).map((g, idx) => (
                        <div
                          key={`${g.name}_${idx}`}
                          className="rounded-xl fs-surface border fs-border p-3.5 flex items-center justify-between"
                        >
                          <div>
                            <div className="text-[11px] fs-accent-text font-bold">
                              المركز {idx + 1}
                            </div>
                            <div className="text-sm font-display font-bold">
                              {g.name}
                            </div>
                            {g.kinshipRelation && (
                              <div className="text-[11px] fs-muted">
                                {g.kinshipRelation}
                              </div>
                            )}
                          </div>
                          <div className="text-left">
                            <div className="text-lg font-display font-bold fs-accent-text">
                              {g.approvedCount}
                            </div>
                            <div className="text-[10px] fs-muted">إثراء معتمد</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Guided Topics */}
              <div className="space-y-4">
                {modules.majlisAndGuardiansModule.topics.map((topic) => {
                  const sortedReplies = [...(topic.replies || [])].sort(
                    (a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)
                  );
                  const draft = majlisReplyInputs[topic.id] || {
                    name: '',
                    body: '',
                  };
                  return (
                    <div
                      key={topic.id}
                      className="rounded-xl fs-muted-surface border fs-border p-5 space-y-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold fs-accent-text">
                            {topic.isWeeklyElderPrompt
                              ? '✦ سؤال الأسبوع لكبار العائلة'
                              : topic.title}
                          </span>
                          {topic.isLocked && (
                            <span className="fs-muted inline-flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              <span>مغلق للتوثيق</span>
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-display font-bold">
                          {topic.promptQuestion}
                        </h3>
                      </div>

                      {sortedReplies.length > 0 && (
                        <div className="space-y-2 pt-2 border-t fs-border">
                          {sortedReplies.map((rep) => (
                            <div
                              key={rep.id}
                              className="rounded-lg fs-surface border fs-border p-3 space-y-1"
                            >
                              <div className="flex items-center justify-between text-xs">
                                <strong className="font-display">
                                  {rep.authorName}
                                </strong>
                                {rep.isPinned && (
                                  <span className="text-[11px] fs-accent-text font-bold inline-flex items-center gap-1">
                                    <Pin className="w-3 h-3" />
                                    <span>مشاركة مثبتة</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-xs fs-muted leading-relaxed">
                                {rep.body}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {!topic.isLocked && (
                        <div className="pt-2 border-t fs-border flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={draft.name}
                            onChange={(e) =>
                              setMajlisReplyInputs((prev) => ({
                                ...prev,
                                [topic.id]: { ...draft, name: e.target.value },
                              }))
                            }
                            placeholder="اسمك الكريم..."
                            className="sm:w-44 px-3 py-2 rounded-xl bg-white/95 text-[#252321] border fs-border text-xs"
                          />
                          <input
                            type="text"
                            value={draft.body}
                            onChange={(e) =>
                              setMajlisReplyInputs((prev) => ({
                                ...prev,
                                [topic.id]: { ...draft, body: e.target.value },
                              }))
                            }
                            placeholder="دوّن مشاركتك أو روايتك في هذا الموضوع..."
                            className="flex-1 px-3 py-2 rounded-xl bg-white/95 text-[#252321] border fs-border text-xs"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (!draft.name.trim() || !draft.body.trim())
                                return;
                              const updated = await addReplyToGuidedMajlisTopic({
                                siteSlug: siteData.siteSlug,
                                topicId: topic.id,
                                authorName: draft.name,
                                body: draft.body,
                              });
                              if (updated) setSiteData(updated);
                              setMajlisReplyInputs((prev) => ({
                                ...prev,
                                [topic.id]: { name: '', body: '' },
                              }));
                            }}
                            className="px-4 py-2 rounded-xl fs-accent-bg text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>نشر المشاركة</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
      </main>

      {/* Footer */}
      <footer className="border-t fs-border fs-surface py-8 px-4 text-center space-y-2">
        <div className="text-xs font-display font-bold">
          ديوان أسرة {siteData.familyName} · موثّق تقنياً ومرجعياً عبر منصة «جذوري»
        </div>
        <div className="text-[11px] fs-muted max-w-xl mx-auto">
          تُعرض في هذه البوابة البيانات المعاصرة والوثائق المختارة فقط وفق سياسات الخصوصية المعتمدة من أمين سجل الأسرة، بينما تبقى سلاسل النسب التاريخية والمصادر المرجعية محفوظة داخل منصة جذوري.
        </div>
      </footer>

      {/* Royal QR Invitation Card Modal */}
      <RoyalQrInvitationModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        familyName={siteData.familyName}
        siteSlug={siteData.siteSlug}
        emblemTag={siteData.familyEmblemTag}
        registrarName={siteData.ownerDisplayName}
        referralCode={siteData.ownerReferralCode}
      />

      {/* Enrichment Proposal Modal («اقترح إثراءً») */}
      {showEnrichmentModal && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 bg-[#252321]/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="w-full max-w-xl rounded-2xl bg-[#F7F2E9] text-[#252321] border border-[#B98A78]/60 shadow-2xl overflow-hidden my-6">
            <div className="px-6 py-4 bg-[#252321] text-[#F7F2E9] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#D8755B]" />
                <h3 className="text-base font-display font-bold">
                  اقتراح إثراء عائلي لأسرة {siteData.familyName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEnrichmentModal(false)}
                className="p-1 rounded-lg text-[#F7F2E9]/70 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {enrSuccessMessage ? (
                <div className="rounded-xl bg-emerald-950/10 border border-emerald-700/30 p-5 text-center space-y-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto" />
                  <p className="text-sm font-display font-bold text-[#252321]">
                    {enrSuccessMessage}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowEnrichmentModal(false)}
                    className="px-5 py-2 rounded-xl bg-[#252321] text-white text-xs font-bold cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitEnrichment} className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        id: 'ADD_TREE_MEMBER' as EnrichmentRequestType,
                        label: 'إضافة مولود / فرع',
                      },
                      {
                        id: 'VAULT_MEDIA' as EnrichmentRequestType,
                        label: 'إهداء صورة / وثيقة',
                      },
                      {
                        id: 'CORRECTION_NOTE' as EnrichmentRequestType,
                        label: 'تصحيح / إثراء سيرة',
                      },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setEnrType(tab.id)}
                        className={`py-2 px-2 rounded-xl text-xs font-display font-bold border transition-colors cursor-pointer ${
                          enrType === tab.id
                            ? 'bg-[#252321] text-[#F7F2E9] border-[#252321]'
                            : 'bg-white text-[#252321] border-[#B98A78]/40'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold mb-1">
                        اسمك الكريم (مقدّم المقترح) *
                      </label>
                      <input
                        type="text"
                        required
                        value={enrRequesterName}
                        onChange={(e) => setEnrRequesterName(e.target.value)}
                        placeholder="مثال: خالد بن محمد..."
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">
                        صلة القرابة / الفرع
                      </label>
                      <input
                        type="text"
                        value={enrKinship}
                        onChange={(e) => setEnrKinship(e.target.value)}
                        placeholder="مثال: ابن عم / حفيد..."
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1">
                      البريد الإلكتروني (لتوثيق اسمك في لوحة شرف حماة الذاكرة)
                    </label>
                    <input
                      type="email"
                      dir="ltr"
                      value={enrRequesterEmail}
                      onChange={(e) => setEnrRequesterEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs"
                    />
                  </div>

                  {treeMembers.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold mb-1">
                        الفرد المعني أو الأب المباشر في الشجرة (اختياري)
                      </label>
                      <select
                        value={enrTargetPersonId}
                        onChange={(e) => setEnrTargetPersonId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs"
                      >
                        <option value="">— اختر من أفراد الشجرة المعروضة —</option>
                        {treeMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.displayName} ({m.relationLabel})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {enrType === 'ADD_TREE_MEMBER' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold mb-1">
                          اسم المولود / الفرد *
                        </label>
                        <input
                          type="text"
                          required
                          value={enrProposedFirstName}
                          onChange={(e) =>
                            setEnrProposedFirstName(e.target.value)
                          }
                          placeholder="الاسم الأول"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1">
                          الجنس
                        </label>
                        <select
                          value={enrProposedGender}
                          onChange={(e) =>
                            setEnrProposedGender(
                              e.target.value as 'male' | 'female'
                            )
                          }
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs"
                        >
                          <option value="male">ذكر</option>
                          <option value="female">أنثى</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1">
                          سنة الميلاد / المكان
                        </label>
                        <input
                          type="text"
                          value={enrProposedBirthYear}
                          onChange={(e) =>
                            setEnrProposedBirthYear(e.target.value)
                          }
                          placeholder="مثال: 2024"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <input
                          type="text"
                          value={enrProposedBirthPlace}
                          onChange={(e) =>
                            setEnrProposedBirthPlace(e.target.value)
                          }
                          placeholder="مدينة الميلاد أو الإقامة (اختياري)"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {enrType === 'VAULT_MEDIA' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          required
                          value={enrMediaTitle}
                          onChange={(e) => setEnrMediaTitle(e.target.value)}
                          placeholder="عنوان الصورة أو الوثيقة *"
                          className="px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs"
                        />
                        <input
                          type="text"
                          value={enrMediaOccasion}
                          onChange={(e) => setEnrMediaOccasion(e.target.value)}
                          placeholder="العام أو المناسبة (مثال: 1395هـ)"
                          className="px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs"
                        />
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleEnrichmentMediaUpload}
                        className="w-full text-xs file:mr-0 file:ml-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#252321] file:text-white file:text-xs file:cursor-pointer"
                      />
                      {enrMediaDataUrl && (
                        <img
                          src={enrMediaDataUrl}
                          alt="معاينة"
                          className="h-24 rounded-lg border border-[#B98A78]/40 object-cover"
                        />
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold mb-1">
                      تفاصيل وملاحظات مساندة لأمين السجل
                    </label>
                    <textarea
                      rows={3}
                      value={enrNotes}
                      onChange={(e) => setEnrNotes(e.target.value)}
                      placeholder="اكتب أي نبذة أو توضيح يساعد أمين السجل على مراجعة المقترح واعتماده..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={enrSubmitting}
                    className="w-full py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold cursor-pointer disabled:opacity-50"
                  >
                    {enrSubmitting
                      ? 'جاري إرسال المقترح إلى أمين السجل...'
                      : 'إرسال مقترح الإثراء لاعتماده في السجل ✦'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
