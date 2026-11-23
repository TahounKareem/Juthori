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
  EyeOff,
  FileText,
  GitBranch,
  Globe,
  Heart,
  HelpCircle,
  Loader2,
  Lock,
  MapPin,
  Maximize2,
  MessageSquare,
  Mic,
  Pause,
  Pin,
  Play,
  PlusCircle,
  QrCode,
  Quote,
  Scroll,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import {
  EnrichmentRequestType,
  KinshipInvitationDoc,
  ModuleVisibility,
  PortalSectionKey,
  PublicMicrositeData,
  PublicVaultProjectedItem,
  addBlessingToFamilyNews,
  addReplyToGuidedMajlisTopic,
  buildDefaultCmsModules,
  fetchKinshipInvitationByToken,
  fetchPublishedMicrositeBySlug,
  incrementElderMemorialPrayer,
  normalizeVisualBranding,
  submitEventRsvpOnMicrosite,
  submitSiteAccessRequest,
  submitTreeEnrichmentRequest,
  submitVaultPhotoFaceIdentification,
} from '../services/priority4Service';
import { processMediaFileForUpload } from '../utils/mediaPipeline';
import { RoyalQrInvitationModal } from './RoyalQrInvitationModal';
import { ACTIVE_PUBLIC_SITE_DISPLAY_HOST } from '../config/referralAndSiteConfig';
import {
  ClaimedKinshipSessionPayload,
  KinshipInviteClaimModal,
} from './KinshipInviteClaimModal';
import {
  FamilyCrestEmblem,
  HeroArchitecturalBackdrop,
  PORTAL_SECTION_LABELS,
  PublicVisualTreeMirror,
} from './FamilySiteHeritageVisuals';

interface PublicFamilyMicrositePageProps {
  siteSlug: string;
  previewData?: PublicMicrositeData | null;
  viewerEmail?: string;
  viewerName?: string;
  viewerKinshipRelation?: string;
  viewerIsAnnualVip?: boolean;
  inviteToken?: string | null;
  isOwnerPreview?: boolean;
  compactPreview?: boolean;
  onExitToMainApp: () => void;
  onStartOwnLineageSearch?: () => void;
  onInvitationClaimed?: (payload: ClaimedKinshipSessionPayload) => void;
  onUpgradeOwnMembershipToAnnualVip?: (familyContext?: {
    familyName: string;
    originCountry?: string;
    originRegion?: string;
  }) => void;
  onGoToOwnDashboard?: () => void;
}

const SESSION_AUTHORIZED_EMAIL_KEY = 'juthori_microsite_circle_email_v1';

const SECTION_SHORT_NAV: Record<PortalSectionKey, string> = {
  patriarch_quote: 'كلمة العميد',
  tree_mirror: 'شجرة العائلة',
  vault_gallery: 'معرض الخزانة',
  news: 'الأخبار',
  events: 'المناسبات',
  stories: 'قصص الأجداد',
  notables: 'لوحة الشرف',
  atlas: 'أطلس الديار',
  oral_heritage: 'الصوتيات',
  professions: 'الكفاءات',
  memorial: 'ركن الوفاء',
  majlis: 'المجلس',
};

function SectionOrnamentHeader({
  kicker,
  title,
  icon,
  action,
}: {
  kicker: string;
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b fs-border">
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold fs-accent-text">
          {icon}
          <span>{kicker}</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold fs-display-font">
          {title}
        </h2>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export const PublicFamilyMicrositePage: React.FC<
  PublicFamilyMicrositePageProps
> = ({
  siteSlug,
  previewData,
  viewerEmail,
  viewerName,
  viewerKinshipRelation,
  viewerIsAnnualVip = false,
  inviteToken,
  isOwnerPreview = false,
  compactPreview = false,
  onExitToMainApp,
  onStartOwnLineageSearch,
  onInvitationClaimed,
  onUpgradeOwnMembershipToAnnualVip,
  onGoToOwnDashboard,
}) => {
  const [siteData, setSiteData] = useState<PublicMicrositeData | null>(
    previewData || null
  );
  const [loading, setLoading] = useState<boolean>(!previewData);
  const [showQrModal, setShowQrModal] = useState(false);
  const [lightboxVaultItem, setLightboxVaultItem] =
    useState<PublicVaultProjectedItem | null>(null);

  // Kinship Capability-Token Invitation State (`?invite={inviteToken}`)
  const [activeInvitation, setActiveInvitation] =
    useState<KinshipInvitationDoc | null>(null);
  const [showInviteClaimModal, setShowInviteClaimModal] = useState(false);
  const [justClaimedRelative, setJustClaimedRelative] = useState<{
    name: string;
    kinshipRelation: string;
    email: string;
  } | null>(null);
  const [inviteOptedOutNotice, setInviteOptedOutNotice] = useState<
    string | null
  >(null);

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
  const [circleVerifyFeedback, setCircleVerifyFeedback] = useState<
    string | null
  >(null);

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
  const [enrRequesterName, setEnrRequesterName] = useState(viewerName || '');
  const [enrRequesterEmail, setEnrRequesterEmail] = useState(
    viewerEmail || activeCircleEmail || ''
  );
  const [enrKinship, setEnrKinship] = useState(viewerKinshipRelation || '');
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
      setEnrRequesterEmail((prev) => prev || clean);
    }
    if (viewerName) {
      setEnrRequesterName((prev) => prev || viewerName);
    }
    if (viewerKinshipRelation) {
      setEnrKinship((prev) => prev || viewerKinshipRelation);
    }
  }, [viewerEmail, viewerName, viewerKinshipRelation]);

  useEffect(() => {
    if (!inviteToken || isOwnerPreview) return;
    let mounted = true;
    fetchKinshipInvitationByToken(inviteToken)
      .then((inv) => {
        if (!mounted || !inv) return;
        setActiveInvitation(inv);
        if (inv.status === 'OPTED_OUT') {
          setInviteOptedOutNotice(
            `تم إلغاء إدراج البريد الإلكتروني (${inv.invitedEmail}) مسبقاً من الدائرة العائلية الخاصة لعائلة ${inv.familyName}.`
          );
          if (
            activeCircleEmail.trim().toLowerCase() ===
            inv.invitedEmail.trim().toLowerCase()
          ) {
            setActiveCircleEmail('');
          }
          return;
        }

        const invitedLower = (inv.invitedEmail || '').trim().toLowerCase();
        const viewerLower = (viewerEmail || '').trim().toLowerCase();
        setEnrRequesterName((prev) => prev || inv.relativeName);
        setEnrRequesterEmail((prev) => prev || invitedLower);
        setEnrKinship((prev) => prev || inv.kinshipRelation);

        if (
          viewerLower &&
          viewerLower === invitedLower &&
          inv.status === 'ACTIVE'
        ) {
          setActiveCircleEmail(invitedLower);
          setJustClaimedRelative({
            name: inv.relativeName,
            kinshipRelation: inv.kinshipRelation,
            email: invitedLower,
          });
        } else {
          setShowInviteClaimModal(true);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [inviteToken, isOwnerPreview, viewerEmail]);

  const handleInviteClaimSuccess = async (
    payload: ClaimedKinshipSessionPayload
  ) => {
    setShowInviteClaimModal(false);
    setActiveInvitation(payload.invitation);
    setActiveCircleEmail(payload.email);
    setCircleEmailInput(payload.email);
    setEnrRequesterName(payload.fullName || payload.firstName);
    setEnrRequesterEmail(payload.email);
    setEnrKinship(payload.kinshipRelation);
    setJustClaimedRelative({
      name: payload.invitation.relativeName || payload.firstName,
      kinshipRelation: payload.kinshipRelation,
      email: payload.email,
    });
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(
          SESSION_AUTHORIZED_EMAIL_KEY,
          payload.email
        );
      } catch {
        // Ignore
      }
    }
    if (onInvitationClaimed) {
      onInvitationClaimed(payload);
    }
    if (!previewData) {
      const refreshed = await fetchPublishedMicrositeBySlug(siteSlug);
      if (refreshed) {
        setSiteData(refreshed);
      }
    }
  };

  const isAuthorizedFamilyCircle = useMemo(() => {
    if (isOwnerPreview || Boolean(previewData)) return true;
    if (activeInvitation?.status === 'OPTED_OUT') return false;
    if (
      justClaimedRelative &&
      activeCircleEmail &&
      justClaimedRelative.email.toLowerCase() ===
        activeCircleEmail.trim().toLowerCase()
    ) {
      return true;
    }
    if (!siteData || !activeCircleEmail) return false;
    const list = (siteData.whitelistedEmails || []).map((e) =>
      e.trim().toLowerCase()
    );
    return list.includes(activeCircleEmail.trim().toLowerCase());
  }, [
    isOwnerPreview,
    previewData,
    siteData,
    activeCircleEmail,
    activeInvitation,
    justClaimedRelative,
  ]);

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
        'مرحباً بك في دائرة العائلة! تم فتح كافة الأقسام العائلية الخاصة لك ✓'
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
        'تم رفع مقترح الإثراء إلى صندوق أمين سجل العائلة بنجاح! سيظهر تلقائياً في البوابة فور اعتماده ✦'
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

  const formatCountdownParts = (
    isoDate: string
  ): { expired: boolean; days: number; hours: number; label: string } => {
    const targetMs = new Date(isoDate).getTime();
    if (Number.isNaN(targetMs)) {
      return { expired: false, days: 0, hours: 0, label: isoDate };
    }
    const diff = targetMs - nowTick;
    if (diff <= 0) {
      return {
        expired: true,
        days: 0,
        hours: 0,
        label: 'حان الموعد / متاح الآن',
      };
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    return {
      expired: false,
      days,
      hours,
      label: `متبقٍّ ${days} يوم و ${hours} ساعة`,
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
        <div className="max-w-md rounded-3xl bg-white border border-[#B98A78]/45 p-8 space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/40 flex items-center justify-center mx-auto">
            <Globe className="w-6 h-6 text-[#8D4925]" />
          </div>
          <h1 className="text-xl font-display font-bold text-[#252321]">
            هذه البوابة العائلية غير منشورة حالياً
          </h1>
          <p className="text-sm text-[#252321]/70 leading-relaxed">
            المعرّف{' '}
            <span className="font-mono font-semibold">
              {ACTIVE_PUBLIC_SITE_DISPLAY_HOST}/{siteSlug}
            </span>{' '}
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
  const branding = normalizeVisualBranding(
    siteData.visualBranding,
    siteData.familyName
  );
  const cms =
    siteData.cmsModules ||
    buildDefaultCmsModules({
      familyName: siteData.familyName,
      originCountry: siteData.originCountry || '',
      originRegion: siteData.originRegion || '',
    });

  // PRIVATE_WHITELIST Gate for unauthorized visitors
  if (
    siteData.siteAccessMode === 'PRIVATE_WHITELIST' &&
    !isAuthorizedFamilyCircle
  ) {
    return (
      <div
        dir="rtl"
        data-family-site-theme={activeTheme}
        data-family-site-typography={branding.typographyId}
        className="min-h-screen fs-canvas flex flex-col justify-between"
      >
        <header className="border-b fs-border fs-surface px-4 sm:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs font-bold">
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
          <div className="rounded-3xl fs-surface border fs-border p-6 sm:p-8 space-y-5 shadow-md">
            <div className="flex flex-col items-center text-center space-y-3">
              <FamilyCrestEmblem
                familyName={siteData.familyName}
                crestMode={branding.crestMode}
                crestStyle={branding.crestStyle}
                customCrestUrl={branding.customCrestUrl}
                size="md"
              />
              <div className="text-xs font-bold fs-accent-text">
                {siteData.familyEmblemTag || `ديوان عائلة ${siteData.familyName}`}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold fs-display-font">
                بوابة عائلة {siteData.familyName} الخاصة
              </h1>
              <p className="text-xs sm:text-sm fs-muted leading-relaxed">
                خصّص أمين سجل العائلة هذه البوابة لأفراد دائرة العائلة والمدعوين فقط حفاظاً على الخصوصية العائلية.
              </p>
            </div>

            {/* Verify Invited Email */}
            <form
              onSubmit={handleVerifyCircleEmail}
              className="rounded-2xl fs-muted-surface border fs-border p-4 space-y-3"
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
                  className="px-4 py-2 rounded-xl fs-accent-bg text-xs font-bold cursor-pointer shrink-0"
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
                <div className="rounded-2xl fs-muted-surface border fs-border p-4 text-center space-y-1.5">
                  <CheckCircle2 className="w-6 h-6 fs-accent-text mx-auto" />
                  <div className="text-sm font-bold fs-display-font">
                    تم رفع طلب الاستئذان إلى أمين سجل عائلة {siteData.familyName}
                  </div>
                  <p className="text-xs fs-muted">
                    ستصلك دعوة الدخول إلى بريدك فور مراجعة واعتماد أمين السجل.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={handleRequestWhitelistAccess}
                  className="space-y-3"
                >
                  <div className="text-xs font-bold">
                    أو أرسل طلب استئذان مهذب لأمين السجل للانضمام لدائرة العائلة:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={accessReqName}
                      onChange={(e) => setAccessReqName(e.target.value)}
                      placeholder="الاسم الكامل"
                      className="px-3 py-2 rounded-xl bg-white text-[#252321] border fs-border text-xs"
                    />
                    <input
                      type="email"
                      dir="ltr"
                      required
                      value={accessReqEmail}
                      onChange={(e) => setAccessReqEmail(e.target.value)}
                      placeholder="البريد الإلكتروني"
                      className="px-3 py-2 rounded-xl bg-white text-[#252321] border fs-border text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    value={accessReqKinship}
                    onChange={(e) => setAccessReqKinship(e.target.value)}
                    placeholder="صلة القرابة بالعائلة (مثال: ابن عم، من فرع الرياض...)"
                    className="w-full px-3 py-2 rounded-xl bg-white text-[#252321] border fs-border text-xs"
                  />
                  <button
                    type="submit"
                    disabled={accessReqBusy}
                    className="w-full py-2.5 rounded-xl fs-accent-bg text-xs font-bold cursor-pointer disabled:opacity-60"
                  >
                    {accessReqBusy
                      ? 'جاري إرسال طلب الاستئذان...'
                      : 'إرسال طلب الانضمام لدائرة العائلة'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </main>

        <footer className="py-5 text-center text-xs fs-muted border-t fs-border">
          موثق رقمياً عبر منصة جذوري للأنساب والإرث العائلي العربي · Juthori.com
        </footer>
      </div>
    );
  }

  // ===========================================================================
  // ZERO EMPTY / DEAD SECTIONS EVALUATOR (STRICT PUBLIC VISIBILITY)
  // ===========================================================================
  const treeMembers = siteData.publishedTreeMembers || [];
  const vaultItems = siteData.publishedVaultItems || [];
  const guardians = siteData.guardiansOfMemory || [];

  const sectionReadiness: Record<
    PortalSectionKey,
    { enabledBySettings: boolean; hasRealContent: boolean }
  > = {
    patriarch_quote: {
      enabledBySettings: Boolean(branding.patriarchQuote.enabled),
      hasRealContent: Boolean(branding.patriarchQuote.text.trim()),
    },
    tree_mirror: {
      enabledBySettings:
        siteData.privacyConfig.showFamilyTree !== false &&
        canRenderVisibility(siteData.privacyConfig.treeVisibility),
      hasRealContent: treeMembers.length > 0,
    },
    vault_gallery: {
      enabledBySettings: canRenderVisibility(
        siteData.privacyConfig.vaultVisibility
      ),
      hasRealContent: vaultItems.length > 0,
    },
    news: {
      enabledBySettings:
        cms.newsModule.enabled &&
        canRenderVisibility(cms.newsModule.visibility),
      hasRealContent: cms.newsModule.items.length > 0,
    },
    events: {
      enabledBySettings:
        cms.eventsModule.enabled &&
        canRenderVisibility(cms.eventsModule.visibility),
      hasRealContent: cms.eventsModule.items.length > 0,
    },
    stories: {
      enabledBySettings:
        cms.storiesModule.enabled &&
        canRenderVisibility(cms.storiesModule.visibility),
      hasRealContent: cms.storiesModule.items.length > 0,
    },
    notables: {
      enabledBySettings:
        cms.notablesModule.enabled &&
        canRenderVisibility(cms.notablesModule.visibility),
      hasRealContent: cms.notablesModule.items.length > 0,
    },
    atlas: {
      enabledBySettings:
        cms.atlasAndStatsModule.enabled &&
        canRenderVisibility(cms.atlasAndStatsModule.visibility),
      hasRealContent: cms.atlasAndStatsModule.locations.length > 0,
    },
    oral_heritage: {
      enabledBySettings:
        cms.oralHeritageModule.enabled &&
        canRenderVisibility(cms.oralHeritageModule.visibility),
      hasRealContent: cms.oralHeritageModule.items.length > 0,
    },
    professions: {
      enabledBySettings:
        cms.professionsModule.enabled &&
        canRenderVisibility(cms.professionsModule.visibility),
      hasRealContent: cms.professionsModule.items.length > 0,
    },
    memorial: {
      enabledBySettings:
        cms.memorialAndCapsuleModule.enabled &&
        canRenderVisibility(cms.memorialAndCapsuleModule.visibility),
      hasRealContent:
        cms.memorialAndCapsuleModule.elders.length > 0 ||
        (cms.memorialAndCapsuleModule.timeCapsule.enabled &&
          Boolean(
            cms.memorialAndCapsuleModule.timeCapsule.sealedMessage.trim()
          )),
    },
    majlis: {
      enabledBySettings:
        cms.majlisAndGuardiansModule.enabled &&
        canRenderVisibility(cms.majlisAndGuardiansModule.visibility),
      hasRealContent:
        cms.majlisAndGuardiansModule.topics.length > 0 ||
        (cms.majlisAndGuardiansModule.showGuardiansHonorRoll &&
          guardians.length > 0),
    },
  };

  const orderedActiveSections = branding.sectionOrder.filter(
    (key) =>
      sectionReadiness[key].enabledBySettings &&
      sectionReadiness[key].hasRealContent
  );

  const hiddenEmptySectionsForOwner = branding.sectionOrder.filter(
    (key) =>
      sectionReadiness[key].enabledBySettings &&
      !sectionReadiness[key].hasRealContent
  );

  // Real Heritage Metrics for Floating Stats Bar
  const generationsCount =
    siteData.treeMetrics?.generationsCount ||
    new Set(treeMembers.map((m) => m.generationLevel)).size;
  const membersCount =
    siteData.treeMetrics?.totalContemporaryMembers || treeMembers.length;
  const locationsCount = cms.atlasAndStatsModule.locations.length;
  const vaultCount = vaultItems.length;

  const portalTitle =
    siteData.bioTitle?.trim() || `ديوان عائلة ${siteData.familyName}`;
  const cleanHeroLocation = [siteData.originRegion, siteData.originCountry]
    .map((v) => (v || '').trim())
    .filter(
      (v) =>
        Boolean(v) &&
        ![
          'غير محدد',
          'غير محددة',
          'غير معروف',
          'غير معروفة',
          '—',
          '-',
          'none',
          'n/a',
          'unknown',
        ].includes(v.toLowerCase())
    )
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .join(' — ');

  const scrollToSection = (key: PortalSectionKey) => {
    if (compactPreview) return;
    const el = document.getElementById(`portal-sec-${key}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Interactive Mutation Handlers
  const handleSendBlessing = async (newsId: string) => {
    const sender = (blessingInputs[newsId] || '').trim();
    if (!sender) return;
    if (previewData) {
      setSiteData((prev) => {
        if (!prev?.cmsModules) return prev;
        return {
          ...prev,
          cmsModules: {
            ...prev.cmsModules,
            newsModule: {
              ...prev.cmsModules.newsModule,
              items: prev.cmsModules.newsModule.items.map((n) =>
                n.id === newsId
                  ? {
                      ...n,
                      blessings: [
                        ...(n.blessings || []),
                        {
                          id: `b_${Date.now()}`,
                          senderName: sender,
                          createdAt: new Date().toISOString(),
                        },
                      ],
                    }
                  : n
              ),
            },
          },
        };
      });
    } else {
      const updated = await addBlessingToFamilyNews({
        siteSlug: siteData.siteSlug,
        newsId,
        senderName: sender,
      });
      if (updated) setSiteData(updated);
    }
    setBlessingInputs((prev) => ({ ...prev, [newsId]: '' }));
    setOpenBlessingId(null);
  };

  const handleSubmitRsvp = async (eventId: string) => {
    if (!rsvpName.trim()) return;
    if (previewData) {
      setSiteData((prev) => {
        if (!prev?.cmsModules) return prev;
        return {
          ...prev,
          cmsModules: {
            ...prev.cmsModules,
            eventsModule: {
              ...prev.cmsModules.eventsModule,
              items: prev.cmsModules.eventsModule.items.map((ev) =>
                ev.id === eventId
                  ? {
                      ...ev,
                      rsvps: [
                        ...(ev.rsvps || []),
                        {
                          id: `rsvp_${Date.now()}`,
                          attendeeName: rsvpName.trim(),
                          status: rsvpStatus,
                          companionsCount: rsvpCompanions,
                          createdAt: new Date().toISOString(),
                        },
                      ],
                    }
                  : ev
              ),
            },
          },
        };
      });
    } else {
      const updated = await submitEventRsvpOnMicrosite({
        siteSlug: siteData.siteSlug,
        eventId,
        attendeeName: rsvpName.trim(),
        status: rsvpStatus,
        companionsCount: rsvpCompanions,
      });
      if (updated) setSiteData(updated);
    }
    setRsvpName('');
    setRsvpCompanions(0);
    setRsvpOpenEventId(null);
  };

  const handlePrayForElder = async (elderId: string) => {
    if (previewData) {
      setSiteData((prev) => {
        if (!prev?.cmsModules) return prev;
        return {
          ...prev,
          cmsModules: {
            ...prev.cmsModules,
            memorialAndCapsuleModule: {
              ...prev.cmsModules.memorialAndCapsuleModule,
              elders: prev.cmsModules.memorialAndCapsuleModule.elders.map(
                (el) =>
                  el.id === elderId
                    ? { ...el, prayersCount: (el.prayersCount || 0) + 1 }
                    : el
              ),
            },
          },
        };
      });
      return;
    }
    const updated = await incrementElderMemorialPrayer({
      siteSlug: siteData.siteSlug,
      elderId,
    });
    if (updated) setSiteData(updated);
  };

  const handleSubmitMajlisReply = async (topicId: string) => {
    const entry = majlisReplyInputs[topicId];
    if (!entry?.name?.trim() || !entry?.body?.trim()) return;
    if (previewData) {
      setSiteData((prev) => {
        if (!prev?.cmsModules) return prev;
        return {
          ...prev,
          cmsModules: {
            ...prev.cmsModules,
            majlisAndGuardiansModule: {
              ...prev.cmsModules.majlisAndGuardiansModule,
              topics: prev.cmsModules.majlisAndGuardiansModule.topics.map((t) =>
                t.id === topicId
                  ? {
                      ...t,
                      replies: [
                        ...(t.replies || []),
                        {
                          id: `rep_${Date.now()}`,
                          authorName: entry.name.trim(),
                          body: entry.body.trim(),
                          createdAt: new Date().toISOString(),
                        },
                      ],
                    }
                  : t
              ),
            },
          },
        };
      });
    } else {
      const updated = await addReplyToGuidedMajlisTopic({
        siteSlug: siteData.siteSlug,
        topicId,
        authorName: entry.name.trim(),
        body: entry.body.trim(),
      });
      if (updated) setSiteData(updated);
    }
    setMajlisReplyInputs((prev) => ({
      ...prev,
      [topicId]: { name: '', body: '' },
    }));
  };

  const handleSubmitFaceId = async (vaultItemId: string) => {
    if (!faceIdSenderName.trim() || !faceIdNote.trim()) return;
    if (previewData) {
      setSiteData((prev) => {
        if (!prev?.publishedVaultItems) return prev;
        return {
          ...prev,
          publishedVaultItems: prev.publishedVaultItems.map((it) =>
            it.id === vaultItemId
              ? {
                  ...it,
                  faceIdNotes: [
                    ...(it.faceIdNotes || []),
                    {
                      id: `fid_${Date.now()}`,
                      senderName: faceIdSenderName.trim(),
                      note: faceIdNote.trim(),
                      createdAt: new Date().toISOString(),
                    },
                  ],
                }
              : it
          ),
        };
      });
    } else {
      const updated = await submitVaultPhotoFaceIdentification({
        siteSlug: siteData.siteSlug,
        vaultItemId,
        senderName: faceIdSenderName.trim(),
        note: faceIdNote.trim(),
      });
      if (updated) setSiteData(updated);
    }
    setFaceIdSenderName('');
    setFaceIdNote('');
    setFaceIdOpenItemId(null);
  };

  // ===========================================================================
  // SECTION RENDERER BY ORDERED SECTION KEY
  // ===========================================================================
  const renderSectionByKey = (key: PortalSectionKey): React.ReactNode => {
    switch (key) {
      // 1. PATRIARCH WELCOME QUOTE
      case 'patriarch_quote':
        return (
          <section
            key={key}
            id={`portal-sec-${key}`}
            className="scroll-mt-24"
          >
            <div
              className="rounded-3xl fs-surface border fs-border p-7 sm:p-10 text-center relative overflow-hidden shadow-xs"
              style={{ borderColor: 'var(--fs-gold)' }}
            >
              <div
                className="w-11 h-11 rounded-full mx-auto mb-4 flex items-center justify-center border"
                style={{
                  backgroundColor: 'var(--fs-surface-alt)',
                  borderColor: 'var(--fs-gold)',
                  color: 'var(--fs-accent)',
                }}
              >
                <Quote className="w-5 h-5" />
              </div>
              <blockquote className="max-w-3xl mx-auto text-lg sm:text-2xl leading-relaxed sm:leading-loose fs-display-font font-bold">
                «{branding.patriarchQuote.text.trim()}»
              </blockquote>
              <div className="mt-5 pt-4 border-t fs-border inline-flex flex-col items-center gap-0.5 px-6">
                <div className="text-sm font-bold fs-accent-text">
                  {branding.patriarchQuote.authorName}
                </div>
                {branding.patriarchQuote.authorTitle && (
                  <div className="text-xs fs-muted">
                    {branding.patriarchQuote.authorTitle}
                  </div>
                )}
              </div>
            </div>
          </section>
        );

      // 2. INTERACTIVE VISUAL TREE MIRROR
      case 'tree_mirror':
        return (
          <section
            key={key}
            id={`portal-sec-${key}`}
            className="scroll-mt-24 space-y-5"
          >
            <SectionOrnamentHeader
              kicker="مشجرة الأجيال المعاصرة"
              title={`مرآة شجرة عائلة ${siteData.familyName}`}
              icon={<GitBranch className="w-4 h-4" />}
            />
            <PublicVisualTreeMirror
              members={treeMembers}
              familyName={siteData.familyName}
              treeDisplaySettings={siteData.treeDisplaySettings}
              isAuthorizedFamilyViewer={isAuthorizedFamilyCircle}
              compactPreview={compactPreview}
              onProposeEnrichment={() => {
                setEnrType('ADD_TREE_MEMBER');
                setEnrSuccessMessage(null);
                setShowEnrichmentModal(true);
              }}
              onStartOwnSearch={onStartOwnLineageSearch}
            />
          </section>
        );

      // 3. MUSEUM VAULT GALLERY + LIGHTBOX
      case 'vault_gallery':
        return (
          <section
            key={key}
            id={`portal-sec-${key}`}
            className="scroll-mt-24 space-y-5"
          >
            <SectionOrnamentHeader
              kicker="مقتنيات أرشيفية مختارة"
              title="معرض خزانة الصور والوثائق"
              icon={<Camera className="w-4 h-4" />}
              action={
                !compactPreview ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEnrType('VAULT_MEDIA');
                      setEnrSuccessMessage(null);
                      setShowEnrichmentModal(true);
                    }}
                    className="px-3.5 py-2 rounded-xl fs-surface border fs-border text-xs font-bold fs-accent-text cursor-pointer hover:opacity-90"
                  >
                    + إهداء صورة للخزانة
                  </button>
                ) : undefined
              }
            />

            <div
              className={
                compactPreview
                  ? 'grid grid-cols-2 gap-3'
                  : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'
              }
            >
              {vaultItems.map((item) => (
                <article
                  key={item.id}
                  className="group rounded-2xl fs-surface border fs-border overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col"
                >
                  <div
                    onClick={() => !compactPreview && setLightboxVaultItem(item)}
                    className="relative aspect-[4/3] fs-surface-alt overflow-hidden cursor-pointer flex items-center justify-center"
                  >
                    {item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <FileText className="w-10 h-10 fs-accent-text opacity-60" />
                    )}

                    {/* Subtle Archival Dynamic Watermark */}
                    {item.watermarkText && (
                      <div
                        className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-md bg-black/50 backdrop-blur-xs text-[10px] text-white/90 font-semibold pointer-events-none"
                      >
                        {item.watermarkText}
                      </div>
                    )}

                    {!compactPreview && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxVaultItem(item);
                        }}
                        title="معاينة مكبرة"
                        className="absolute top-2.5 left-2.5 w-8 h-8 rounded-lg bg-black/55 hover:bg-black/75 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between gap-2.5">
                    <div>
                      <h3 className="text-sm font-bold fs-display-font line-clamp-1">
                        {item.title}
                      </h3>
                      <div className="text-[11px] fs-muted mt-0.5 tabular-nums">
                        {item.dateOrOccasion}
                        {item.mediaType === 'document' ? ' · وثيقة' : ' · صورة'}
                      </div>
                    </div>

                    {siteData.privacyConfig.enablePhotoFacePrompt &&
                      !compactPreview && (
                        <div className="pt-2 border-t fs-border space-y-2">
                          <button
                            type="button"
                            onClick={() =>
                              setFaceIdOpenItemId(
                                faceIdOpenItemId === item.id ? null : item.id
                              )
                            }
                            className="text-[11px] font-bold fs-accent-text hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>
                              هل تعرف شخصاً في هذه الصورة؟ ({item.faceIdNotes?.length || 0})
                            </span>
                          </button>
                          {faceIdOpenItemId === item.id && (
                            <div className="space-y-1.5 pt-1">
                              <input
                                type="text"
                                value={faceIdSenderName}
                                onChange={(e) =>
                                  setFaceIdSenderName(e.target.value)
                                }
                                placeholder="اسمك الكريم"
                                className="w-full px-2.5 py-1.5 rounded-lg fs-surface-alt border fs-border text-xs"
                              />
                              <input
                                type="text"
                                value={faceIdNote}
                                onChange={(e) => setFaceIdNote(e.target.value)}
                                placeholder="مثال: الواقف يميناً هو الجد..."
                                className="w-full px-2.5 py-1.5 rounded-lg fs-surface-alt border fs-border text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleSubmitFaceId(item.id)}
                                className="w-full py-1.5 rounded-lg fs-accent-bg text-xs font-bold cursor-pointer"
                              >
                                إرسال التعريف
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        );

      // 4. FAMILY NEWS & BLESSINGS
      case 'news':
        return (
          <section
            key={key}
            id={`portal-sec-${key}`}
            className="scroll-mt-24 space-y-5"
          >
            <SectionOrnamentHeader
              kicker="تباشير وأفراح العائلة"
              title="أخبار ومستجدات العائلة"
              icon={<Sparkles className="w-4 h-4" />}
            />
            <div
              className={
                compactPreview
                  ? 'grid grid-cols-1 gap-3'
                  : 'grid grid-cols-1 md:grid-cols-2 gap-5'
              }
            >
              {cms.newsModule.items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl fs-surface border fs-border overflow-hidden shadow-xs flex flex-col justify-between"
                >
                  {item.imageUrl && (
                    <div className="aspect-[16/9] w-full overflow-hidden fs-surface-alt border-b fs-border">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold fs-accent-text">
                          {item.category}
                        </span>
                        <span className="fs-muted tabular-nums">
                          {item.dateLabel}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold fs-display-font">
                        {item.title}
                      </h3>
                      <p className="text-xs sm:text-sm fs-muted leading-relaxed">
                        {item.summary}
                      </p>
                    </div>

                    <div className="pt-3 border-t fs-border space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs fs-muted tabular-nums">
                          التبريكات ({item.blessings?.length || 0})
                        </span>
                        {!compactPreview && (
                          <button
                            type="button"
                            onClick={() =>
                              setOpenBlessingId(
                                openBlessingId === item.id ? null : item.id
                              )
                            }
                            className="text-xs font-bold fs-accent-text hover:underline cursor-pointer"
                          >
                            + أرسل تهنئة ومباركة
                          </button>
                        )}
                      </div>

                      {openBlessingId === item.id && (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={blessingInputs[item.id] || ''}
                            onChange={(e) =>
                              setBlessingInputs((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            placeholder="اكتب اسمك الكريم للمباركة..."
                            className="flex-1 px-3 py-1.5 rounded-xl fs-surface-alt border fs-border text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleSendBlessing(item.id)}
                            className="px-3.5 py-1.5 rounded-xl fs-accent-bg text-xs font-bold cursor-pointer"
                          >
                            مبارك
                          </button>
                        </div>
                      )}

                      {item.blessings && item.blessings.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 text-[11px] fs-muted">
                          {item.blessings.slice(-5).map((b) => (
                            <span
                              key={b.id}
                              className="px-2.5 py-0.5 rounded-lg fs-surface-alt border fs-border"
                            >
                              ✦ {b.senderName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );

      // 5. EVENTS WITH LIVE COUNTDOWN (DAYS & HOURS) + RSVP
      case 'events':
        return (
          <section
            key={key}
            id={`portal-sec-${key}`}
            className="scroll-mt-24 space-y-5"
          >
            <SectionOrnamentHeader
              kicker="لقاءات وصلة رحم"
              title="المناسبات والملتقيات القادمة"
              icon={<Calendar className="w-4 h-4" />}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {cms.eventsModule.items.map((ev) => {
                const cd = formatCountdownParts(ev.eventDateIso);
                const attendingTotal = (ev.rsvps || [])
                  .filter((r) => r.status === 'attending')
                  .reduce((sum, r) => sum + 1 + (r.companionsCount || 0), 0);
                return (
                  <article
                    key={ev.id}
                    className="rounded-2xl fs-surface border fs-border p-5 space-y-4 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-base sm:text-lg font-bold fs-display-font">
                          {ev.title}
                        </h3>
                        <div className="text-xs fs-muted flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 fs-accent-text" />
                            <span>{ev.locationLabel}</span>
                          </span>
                          <span>·</span>
                          <span className="tabular-nums">{ev.eventDateIso}</span>
                        </div>
                      </div>
                      {!cd.expired && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="px-2.5 py-1.5 rounded-xl fs-surface-alt border fs-border text-center min-w-[48px]">
                            <div className="text-sm font-bold fs-accent-text tabular-nums leading-none">
                              {cd.days}
                            </div>
                            <div className="text-[9px] fs-muted mt-0.5">يوم</div>
                          </div>
                          <div className="px-2.5 py-1.5 rounded-xl fs-surface-alt border fs-border text-center min-w-[48px]">
                            <div className="text-sm font-bold fs-accent-text tabular-nums leading-none">
                              {cd.hours}
                            </div>
                            <div className="text-[9px] fs-muted mt-0.5">ساعة</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {ev.hostNote && (
                      <p className="text-xs fs-muted leading-relaxed">
                        {ev.hostNote}
                      </p>
                    )}

                    <div className="pt-3 border-t fs-border flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold fs-muted tabular-nums">
                        المؤكد حضورهم: {attendingTotal}
                      </span>
                      {!compactPreview && (
                        <button
                          type="button"
                          onClick={() =>
                            setRsvpOpenEventId(
                              rsvpOpenEventId === ev.id ? null : ev.id
                            )
                          }
                          className="px-3.5 py-1.5 rounded-xl fs-accent-bg text-xs font-bold cursor-pointer"
                        >
                          تأكيد الحضور (RSVP)
                        </button>
                      )}
                    </div>

                    {rsvpOpenEventId === ev.id && (
                      <div className="rounded-xl fs-surface-alt border fs-border p-3.5 space-y-2.5">
                        <input
                          type="text"
                          value={rsvpName}
                          onChange={(e) => setRsvpName(e.target.value)}
                          placeholder="الاسم الكامل"
                          className="w-full px-3 py-1.5 rounded-lg fs-surface border fs-border text-xs"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={rsvpStatus}
                            onChange={(e) =>
                              setRsvpStatus(
                                e.target.value as 'attending' | 'apologizing'
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg fs-surface border fs-border text-xs"
                          >
                            <option value="attending">سأحضر بإذن الله</option>
                            <option value="apologizing">أعتذر مع التمنيات بالتوفيق</option>
                          </select>
                          <input
                            type="number"
                            min={0}
                            max={15}
                            value={rsvpCompanions}
                            onChange={(e) =>
                              setRsvpCompanions(Number(e.target.value) || 0)
                            }
                            placeholder="عدد المرافقين"
                            className="px-2.5 py-1.5 rounded-lg fs-surface border fs-border text-xs"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSubmitRsvp(ev.id)}
                          className="w-full py-2 rounded-lg fs-accent-bg text-xs font-bold cursor-pointer"
                        >
                          حفظ تأكيد الحضور
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        );

      // 6. ANCESTOR STORIES & MEMORIES
      case 'stories':
        return (
          <section
            key={key}
            id={`portal-sec-${key}`}
            className="scroll-mt-24 space-y-5"
          >
            <SectionOrnamentHeader
              kicker="سِير ومواقف خالدة"
              title="قصص الأجداد وذاكرة العائلة"
              icon={<BookOpen className="w-4 h-4" />}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {cms.storiesModule.items.map((st) => (
                <article
                  key={st.id}
                  className="rounded-2xl fs-surface border fs-border overflow-hidden shadow-xs flex flex-col"
                >
                  {st.imageUrl && (
                    <div className="aspect-[16/9] w-full overflow-hidden fs-surface-alt border-b fs-border">
                      <img
                        src={st.imageUrl}
                        alt={st.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-6 space-y-2.5 flex-1">
                    <div className="text-xs font-bold fs-accent-text tabular-nums">
                      {st.eraOrYearLabel}
                    </div>
                    <h3 className="text-lg font-bold fs-display-font">
                      {st.title}
                    </h3>
                    <p className="text-xs sm:text-sm fs-muted leading-loose whitespace-pre-line">
                      {st.body}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );

      // 7. HALL OF FAME / NOTABLES
      case 'notables':
        return (
          <section
            key={key}
            id={`portal-sec-${key}`}
            className="scroll-mt-24 space-y-5"
          >
            <SectionOrnamentHeader
              kicker="أعلام وإنجازات مشرّفة"
              title={`لوحة شرف عائلة ${siteData.familyName}`}
              icon={<Award className="w-4 h-4" />}
            />
            <div
              className={
                compactPreview
                  ? 'grid grid-cols-1 gap-3'
                  : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'
              }
            >
              {cms.notablesModule.items.map((n) => (
                <article
                  key={n.id}
                  className="rounded-2xl fs-surface border fs-border p-5 space-y-3 shadow-xs hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className="w-14 h-14 rounded-2xl overflow-hidden border-2 flex items-center justify-center shrink-0"
                      style={{
                        borderColor: 'var(--fs-gold)',
                        backgroundColor: 'var(--fs-hero-bg)',
                        color: 'var(--fs-gold)',
                      }}
                    >
                      {n.imageUrl ? (
                        <img
                          src={n.imageUrl}
                          alt={n.fullName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Award className="w-6 h-6" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold fs-display-font truncate">
                        {n.fullName}
                      </h3>
                      <div className="text-xs font-semibold fs-accent-text truncate">
                        {n.roleOrTitle}
                      </div>
                      {n.eraLabel && (
                        <div className="text-[11px] fs-muted tabular-nums">
                          {n.eraLabel}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm fs-muted leading-relaxed pt-2 border-t fs-border">
                    {n.achievementSummary}
                  </p>
                </article>
              ))}
            </div>
          </section>
        );

      // 8. ATLAS OF HOMELANDS
      case 'atlas': {
        const maxLoc = Math.max(
          1,
          ...cms.atlasAndStatsModule.locations.map(
            (l) => l.householdsOrMembersCount || 1
          )
        );
        return (
          <section
            key={key}
            id={`portal-sec-${key}`}
            className="scroll-mt-24 space-y-5"
          >
            <SectionOrnamentHeader
              kicker="الانتشار الجغرافي والديار"
              title="أطلس ديار وحواضر العائلة"
              icon={<MapPin className="w-4 h-4" />}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cms.atlasAndStatsModule.locations.map((loc) => {
                const widthPct = Math.max(
                  15,
                  Math.round(
                    ((loc.householdsOrMembersCount || 1) / maxLoc) * 100
                  )
                );
                return (
                  <div
                    key={loc.id}
                    className="rounded-2xl fs-surface border fs-border p-4 space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold fs-display-font">
                          {loc.city}
                        </div>
                        <div className="text-xs fs-muted">{loc.country}</div>
                      </div>
                      <span className="text-sm font-bold fs-accent-text tabular-nums">
                        {loc.householdsOrMembersCount} عائلة/فرد
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full fs-surface-alt overflow-hidden">
                      <div
                        className="h-full rounded-full fs-accent-bg"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      }

      // 9. ORAL HERITAGE & AUDIO ARCHIVE
      case 'oral_heritage':
        return (
          <section
            key={key}
            id={`portal-sec-${key}`}
            className="scroll-mt-24 space-y-5"
          >
            <SectionOrnamentHeader
              kicker="أصوات وقصائد ومرويات"
              title="الموروث الصوتي والشعري"
              icon={<Mic className="w-4 h-4" />}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cms.oralHeritageModule.items.map((clip) => {
                const isPlaying = playingClipId === clip.id;
                return (
                  <div
                    key={clip.id}
                    className="rounded-2xl fs-surface border fs-border p-5 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          disabled={!clip.audioDataOrUrl}
                          onClick={() =>
                            handleTogglePlayClip(clip.id, clip.audioDataOrUrl)
                          }
                          className="w-11 h-11 rounded-full fs-accent-bg flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-45"
                        >
                          {isPlaying ? (
                            <Pause className="w-5 h-5" />
                          ) : (
                            <Play className="w-5 h-5" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold fs-display-font truncate">
                            {clip.title}
                          </h3>
                          <div className="text-xs fs-muted truncate">
                            {clip.speakerName} · {clip.recordedYearLabel}
                          </div>
                        </div>
                      </div>
                      <Volume2 className="w-4 h-4 fs-accent-text shrink-0 opacity-75" />
                    </div>
                    {clip.transcriptExcerpt && (
                      <p className="text-xs fs-muted leading-relaxed pt-2 border-t fs-border">
                        «{clip.transcriptExcerpt}»
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );

      // 10. PROFESSIONS DIRECTORY
      case 'professions':
        return (
          <section
            key={key}
            id={`portal-sec-${key}`}
            className="scroll-mt-24 space-y-5"
          >
            <SectionOrnamentHeader
              kicker="التكافل والخبرات العائلية"
              title="دليل الكفاءات والتخصصات"
              icon={<Briefcase className="w-4 h-4" />}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cms.professionsModule.items.map((prof) => (
                <div
                  key={prof.id}
                  className="rounded-2xl fs-surface border fs-border p-4 space-y-1.5 shadow-2xs"
                >
                  <div className="text-[11px] font-bold fs-accent-text">
                    {prof.fieldCategory}
                  </div>
                  <div className="text-sm font-bold fs-display-font">
                    {prof.memberName}
                  </div>
                  <div className="text-xs fs-muted">
                    {prof.specialtyOrProfession}
                    {prof.cityCountryLabel ? ` · ${prof.cityCountryLabel}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );

      // 11. MEMORIAL & TIME CAPSULE
      case 'memorial': {
        const cap = cms.memorialAndCapsuleModule.timeCapsule;
        const capCountdown = cap.enabled
          ? formatCountdownParts(cap.unlockDateIso)
          : null;
        return (
          <section
            key={key}
            id={`portal-sec-${key}`}
            className="scroll-mt-24 space-y-5"
          >
            <SectionOrnamentHeader
              kicker="برّ ووفاء للراحلين ورسائل للأجيال"
              title="ركن الوفاء والدعاء وكبسولة الزمن"
              icon={<Heart className="w-4 h-4" />}
            />

            {cms.memorialAndCapsuleModule.elders.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {cms.memorialAndCapsuleModule.elders.map((el) => (
                  <article
                    key={el.id}
                    className="rounded-2xl fs-surface border fs-border p-5 space-y-3 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold fs-display-font">
                          {el.fullName}
                        </h3>
                        <div className="text-xs fs-muted tabular-nums">
                          {el.passingYearLabel}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePrayForElder(el.id)}
                        className="px-3 py-1.5 rounded-xl fs-surface-alt border fs-border hover:opacity-90 text-xs font-bold fs-accent-text inline-flex items-center gap-1.5 cursor-pointer tabular-nums shrink-0"
                      >
                        <Heart className="w-3.5 h-3.5" />
                        <span>دعوت له ({el.prayersCount || 0})</span>
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm fs-muted leading-relaxed">
                      {el.biographyNote}
                    </p>
                    {el.ongoingCharityTitle && (
                      <div className="rounded-xl fs-surface-alt border fs-border px-3.5 py-2 text-xs">
                        <span className="font-bold fs-accent-text">
                          الصدقة الجارية:{' '}
                        </span>
                        <span>{el.ongoingCharityTitle}</span>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}

            {cap.enabled && cap.sealedMessage.trim() && capCountdown && (
              <div
                className="rounded-3xl fs-hero p-6 sm:p-8 space-y-3 border"
                style={{ borderColor: 'var(--fs-gold)' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-xs font-bold fs-gold-text">
                    <Clock className="w-4 h-4" />
                    <span>كبسولة الزمن العائلية</span>
                  </div>
                  <span className="text-xs opacity-85 tabular-nums">
                    {capCountdown.label}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold fs-display-font">
                  {cap.title}
                </h3>
                <div className="text-xs opacity-75">
                  بقلم: {cap.authorElderName}
                </div>
                {capCountdown.expired ? (
                  <p className="text-sm leading-loose pt-2 border-t border-white/15">
                    {cap.sealedMessage}
                  </p>
                ) : (
                  <p className="text-xs opacity-80 pt-2 border-t border-white/15">
                    الرسالة محفوظة ومختومة رقمياً حتى تاريخ الفتح المحدد ({cap.unlockDateIso}).
                  </p>
                )}
              </div>
            )}
          </section>
        );
      }

      // 12. GUIDED MAJLIS & GUARDIANS OF MEMORY
      case 'majlis':
        return (
          <section
            key={key}
            id={`portal-sec-${key}`}
            className="scroll-mt-24 space-y-5"
          >
            <SectionOrnamentHeader
              kicker="حوار العائلة وتكريم المساهمين"
              title="مجلس العائلة وحرّاس الذاكرة"
              icon={<MessageSquare className="w-4 h-4" />}
            />

            {cms.majlisAndGuardiansModule.showGuardiansHonorRoll &&
              guardians.length > 0 && (
                <div className="rounded-2xl fs-surface-alt border fs-border p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs font-bold fs-accent-text flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>حرّاس ذاكرة العائلة الأكثر إثراءً:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {guardians.map((g, i) => (
                      <span
                        key={`${g.name}-${i}`}
                        className="px-3 py-1 rounded-xl fs-surface border fs-border text-xs font-bold tabular-nums"
                      >
                        ✦ {g.name} ({g.approvedCount} إثراء)
                      </span>
                    ))}
                  </div>
                </div>
              )}

            <div className="space-y-4">
              {cms.majlisAndGuardiansModule.topics.map((topic) => (
                <article
                  key={topic.id}
                  className="rounded-2xl fs-surface border fs-border p-5 space-y-3.5 shadow-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs fs-accent-text font-bold">
                      {topic.isWeeklyElderPrompt && (
                        <Pin className="w-3.5 h-3.5" />
                      )}
                      <span>محور حوار عائلي</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold fs-display-font">
                      {topic.title}
                    </h3>
                    <p className="text-xs sm:text-sm fs-muted leading-relaxed">
                      {topic.promptQuestion}
                    </p>
                  </div>

                  {topic.replies && topic.replies.length > 0 && (
                    <div className="space-y-2 pt-2 border-t fs-border">
                      {topic.replies.map((rep) => (
                        <div
                          key={rep.id}
                          className="rounded-xl fs-surface-alt border fs-border px-3.5 py-2.5 text-xs space-y-1"
                        >
                          <div className="font-bold fs-accent-text">
                            {rep.authorName}
                          </div>
                          <p className="leading-relaxed">{rep.body}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {!topic.isLocked && !compactPreview && (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2">
                      <input
                        type="text"
                        value={majlisReplyInputs[topic.id]?.name || ''}
                        onChange={(e) =>
                          setMajlisReplyInputs((prev) => ({
                            ...prev,
                            [topic.id]: {
                              name: e.target.value,
                              body: prev[topic.id]?.body || '',
                            },
                          }))
                        }
                        placeholder="اسمك الكريم"
                        className="sm:col-span-4 px-3 py-2 rounded-xl fs-surface-alt border fs-border text-xs"
                      />
                      <input
                        type="text"
                        value={majlisReplyInputs[topic.id]?.body || ''}
                        onChange={(e) =>
                          setMajlisReplyInputs((prev) => ({
                            ...prev,
                            [topic.id]: {
                              name: prev[topic.id]?.name || '',
                              body: e.target.value,
                            },
                          }))
                        }
                        placeholder="أضف مشاركتك في المجلس..."
                        className="sm:col-span-6 px-3 py-2 rounded-xl fs-surface-alt border fs-border text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleSubmitMajlisReply(topic.id)}
                        className="sm:col-span-2 py-2 px-3 rounded-xl fs-accent-bg text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>مشاركة</span>
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        );
    }
  };

  return (
    <div
      dir="rtl"
      data-family-site-theme={activeTheme}
      data-family-site-typography={branding.typographyId}
      className={`${
        compactPreview ? 'min-h-full' : 'min-h-screen'
      } fs-canvas flex flex-col justify-between selection:bg-amber-200/40`}
    >
      <audio
        ref={audioElementRef}
        onEnded={() => setPlayingClipId(null)}
        className="hidden"
      />

      {/* ================================================================= */}
      {/* 1. STICKY GLASSMORPHIC TOP NAVIGATION BAR                         */}
      {/* ================================================================= */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/85 border-b fs-border">
        <div
          className={`${
            compactPreview ? 'px-4 py-2.5' : 'max-w-6xl mx-auto px-4 sm:px-6 py-3'
          } flex items-center justify-between gap-4`}
        >
          {/* Right: Mini Crest + Diwan Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <FamilyCrestEmblem
              familyName={siteData.familyName}
              crestMode={branding.crestMode}
              crestStyle={branding.crestStyle}
              customCrestUrl={branding.customCrestUrl}
              size="xs"
            />
            <span className="text-sm sm:text-base font-bold fs-display-font truncate text-[#231F1C]">
              {portalTitle}
            </span>
          </div>

          {/* Center: Dynamic Anchor Links (ONLY Sections with Real Content) */}
          {!compactPreview && orderedActiveSections.length > 0 && (
            <nav
              aria-label="أقسام البوابة"
              className="hidden lg:flex items-center gap-5 text-xs font-bold text-[#231F1C]/80 overflow-x-auto"
            >
              {orderedActiveSections.slice(0, 6).map((secKey) => (
                <button
                  key={secKey}
                  type="button"
                  onClick={() => scrollToSection(secKey)}
                  className="hover:opacity-100 fs-accent-text/80 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {SECTION_SHORT_NAV[secKey]}
                </button>
              ))}
            </nav>
          )}

          {/* Left: Share/QR + Propose Enrichment */}
          <div className="flex items-center gap-2 shrink-0">
            {!compactPreview && (
              <>
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="h-8 px-3 rounded-xl fs-surface-alt border fs-border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90 whitespace-nowrap"
                >
                  <QrCode className="w-3.5 h-3.5 fs-accent-text" />
                  <span className="hidden sm:inline">مشاركة وQR</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnrSuccessMessage(null);
                    setShowEnrichmentModal(true);
                  }}
                  className="h-8 px-3 rounded-xl fs-accent-bg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 whitespace-nowrap"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">اقتراح إثراء</span>
                </button>
                {!isOwnerPreview && (
                  <button
                    type="button"
                    onClick={onExitToMainApp}
                    title="منصة جذوري"
                    className="h-8 px-2.5 rounded-xl border fs-border text-xs font-bold text-[#231F1C]/75 hover:text-[#231F1C] cursor-pointer whitespace-nowrap"
                  >
                    جذوري
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Optional Kinship Notices (Claimed / Opt-out) */}
      {(justClaimedRelative || inviteOptedOutNotice) && !compactPreview && (
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 pt-4">
          {justClaimedRelative && (
            <div className="rounded-2xl fs-surface border fs-border px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold fs-accent-text">
                ✦ أهلاً بك يا {justClaimedRelative.name} ({justClaimedRelative.kinshipRelation}) في دائرة عائلة {siteData.familyName} الموثقة.
              </span>
              {!viewerIsAnnualVip && onUpgradeOwnMembershipToAnnualVip && (
                <button
                  type="button"
                  onClick={() =>
                    onUpgradeOwnMembershipToAnnualVip({
                      familyName: siteData.familyName,
                      originCountry: siteData.originCountry,
                      originRegion: siteData.originRegion,
                    })
                  }
                  className="font-bold underline fs-accent-text cursor-pointer"
                >
                  تأسيس حسابك الخاص في جذوري
                </button>
              )}
              {viewerIsAnnualVip && onGoToOwnDashboard && (
                <button
                  type="button"
                  onClick={onGoToOwnDashboard}
                  className="font-bold underline fs-accent-text cursor-pointer"
                >
                  لوحة تحكمك
                </button>
              )}
            </div>
          )}
          {inviteOptedOutNotice && (
            <div className="rounded-2xl bg-amber-50 border border-amber-300 px-4 py-3 text-xs font-semibold text-amber-950">
              {inviteOptedOutNotice}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 2. CINEMATIC HERITAGE HERO + FLOATING HERITAGE STATS BAR          */}
      {/* ================================================================= */}
      <section className="relative overflow-hidden fs-hero">
        <HeroArchitecturalBackdrop branding={branding} />

        <div
          className={`relative z-10 ${
            compactPreview
              ? 'px-5 pt-9 pb-14'
              : 'max-w-6xl mx-auto px-5 sm:px-8 pt-14 pb-20 sm:pt-20 sm:pb-24'
          }`}
        >
          {/* HERO LAYOUT 1: CENTERED ROYAL */}
          {branding.heroLayout === 'centered_royal' && (
            <div className="max-w-3xl mx-auto text-center flex flex-col items-center space-y-5">
              <FamilyCrestEmblem
                familyName={siteData.familyName}
                crestMode={branding.crestMode}
                crestStyle={branding.crestStyle}
                customCrestUrl={branding.customCrestUrl}
                size={compactPreview ? 'md' : 'lg'}
              />

              <div className="space-y-3">
                <div className="text-xs sm:text-sm font-bold fs-gold-text tracking-wide">
                  {siteData.familyEmblemTag ||
                    `ديوان وسجل عائلة ${siteData.familyName} المعاصر`}
                </div>
                <h1
                  className={`${
                    compactPreview
                      ? 'text-2xl'
                      : 'text-3xl sm:text-5xl leading-tight'
                  } font-bold fs-display-font text-balance`}
                >
                  {portalTitle}
                </h1>
                {siteData.bioDescription &&
                  siteData.privacyConfig.showBio !== false && (
                    <p
                      className={`${
                        compactPreview ? 'text-xs' : 'text-sm sm:text-base'
                      } opacity-90 leading-relaxed max-w-2xl mx-auto`}
                    >
                      {siteData.bioDescription}
                    </p>
                  )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs opacity-90 pt-1">
                {cleanHeroLocation && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 fs-gold-text" />
                    <span>{cleanHeroLocation}</span>
                  </span>
                )}
                {siteData.isRegistrarCertified && (
                  <>
                    {cleanHeroLocation && <span className="opacity-40">·</span>}
                    <span className="inline-flex items-center gap-1.5 fs-gold-text font-bold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>أمين سجل عائلي موثق</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* HERO LAYOUT 2: EDITORIAL SPLIT */}
          {branding.heroLayout === 'editorial_split' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              <div className="md:col-span-8 space-y-4 text-right">
                <div className="text-xs sm:text-sm font-bold fs-gold-text">
                  {siteData.familyEmblemTag ||
                    `ديوان عائلة ${siteData.familyName}`}
                </div>
                <h1
                  className={`${
                    compactPreview
                      ? 'text-2xl'
                      : 'text-3xl sm:text-5xl leading-tight'
                  } font-bold fs-display-font text-balance`}
                >
                  {portalTitle}
                </h1>
                {siteData.bioDescription &&
                  siteData.privacyConfig.showBio !== false && (
                    <p className="text-sm sm:text-base opacity-90 leading-relaxed max-w-2xl">
                      {siteData.bioDescription}
                    </p>
                  )}
                <div className="flex flex-wrap items-center gap-4 text-xs opacity-90 pt-1">
                  {cleanHeroLocation && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 fs-gold-text" />
                      <span>{cleanHeroLocation}</span>
                    </span>
                  )}
                  {siteData.isRegistrarCertified && (
                    <span className="inline-flex items-center gap-1.5 fs-gold-text font-bold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>أمين سجل عائلي موثق</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="md:col-span-4 flex justify-center">
                <div className="rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 p-6 flex flex-col items-center gap-3 text-center">
                  <FamilyCrestEmblem
                    familyName={siteData.familyName}
                    crestMode={branding.crestMode}
                    crestStyle={branding.crestStyle}
                    customCrestUrl={branding.customCrestUrl}
                    size={compactPreview ? 'md' : 'lg'}
                  />
                  <div dir="ltr" className="text-xs font-bold fs-gold-text">
                    {ACTIVE_PUBLIC_SITE_DISPLAY_HOST}/{siteData.siteSlug}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* HERO LAYOUT 3: FLOATING GLASS CARD */}
          {branding.heroLayout === 'floating_glass' && (
            <div className="max-w-3xl mx-auto rounded-3xl bg-black/35 backdrop-blur-md border border-white/20 p-6 sm:p-10 text-center flex flex-col items-center space-y-4 shadow-2xl">
              <FamilyCrestEmblem
                familyName={siteData.familyName}
                crestMode={branding.crestMode}
                crestStyle={branding.crestStyle}
                customCrestUrl={branding.customCrestUrl}
                size={compactPreview ? 'sm' : 'md'}
              />
              <div className="text-xs font-bold fs-gold-text">
                {siteData.familyEmblemTag ||
                  `ديوان عائلة ${siteData.familyName}`}
              </div>
              <h1
                className={`${
                  compactPreview
                    ? 'text-xl'
                    : 'text-3xl sm:text-4xl leading-tight'
                } font-bold fs-display-font text-balance`}
              >
                {portalTitle}
              </h1>
              {siteData.bioDescription &&
                siteData.privacyConfig.showBio !== false && (
                  <p className="text-xs sm:text-sm opacity-90 leading-relaxed max-w-2xl">
                    {siteData.bioDescription}
                  </p>
                )}
              <div className="flex flex-wrap items-center justify-center gap-3 text-xs fs-gold-text font-semibold pt-1">
                {cleanHeroLocation && <span>{cleanHeroLocation}</span>}
                {siteData.isRegistrarCertified && (
                  <span>
                    {cleanHeroLocation ? '· ' : ''}سجل عائلي موثق ✦
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* FLOATING HERITAGE STATS BAR */}
      <div
        className={`relative z-20 ${
          compactPreview
            ? 'px-4 -mt-8'
            : 'max-w-5xl mx-auto w-full px-4 sm:px-6 -mt-10'
        }`}
      >
        <div
          className={`rounded-2xl fs-surface border fs-border shadow-lg grid ${
            compactPreview
              ? 'grid-cols-2 divide-y'
              : 'grid-cols-2 md:grid-cols-4'
          } overflow-hidden`}
        >
          <div className="p-4 text-center border-l fs-border">
            <div className="text-xl sm:text-2xl font-bold fs-display-font fs-accent-text tabular-nums">
              {membersCount}
            </div>
            <div className="text-[11px] font-bold fs-muted mt-0.5">
              أفراد العائلة الموثقون
            </div>
          </div>
          <div className="p-4 text-center md:border-l fs-border">
            <div className="text-xl sm:text-2xl font-bold fs-display-font fs-accent-text tabular-nums">
              {generationsCount}
            </div>
            <div className="text-[11px] font-bold fs-muted mt-0.5">
              الأجيال المتصلة
            </div>
          </div>
          <div className="p-4 text-center border-l fs-border">
            <div className="text-xl sm:text-2xl font-bold fs-display-font fs-accent-text tabular-nums">
              {vaultCount}
            </div>
            <div className="text-[11px] font-bold fs-muted mt-0.5">
              مقتنيات الخزانة المعروضة
            </div>
          </div>
          <div className="p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold fs-display-font fs-accent-text tabular-nums">
              {locationsCount || 1}
            </div>
            <div className="text-[11px] font-bold fs-muted mt-0.5">
              الديار والحواضر
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 3. DYNAMIC ORDERED CONTENT SECTIONS (ZERO EMPTY SECTIONS)         */}
      {/* ================================================================= */}
      <main
        className={`${
          compactPreview
            ? 'px-4 py-8 space-y-8'
            : 'max-w-6xl mx-auto w-full px-4 sm:px-6 py-12 space-y-14'
        } flex-1`}
      >
        {orderedActiveSections.map((secKey) => renderSectionByKey(secKey))}

        {/* Transparent Owner-Only Studio Note for Hidden Empty Sections */}
        {isOwnerPreview && hiddenEmptySectionsForOwner.length > 0 && (
          <div className="rounded-2xl border border-dashed fs-border fs-surface-alt/70 p-4 flex items-start gap-3 text-xs">
            <EyeOff className="w-4 h-4 fs-accent-text shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">
                ملاحظة استوديو أمين السجل (لا تظهر للزوار):
              </div>
              <p className="fs-muted leading-relaxed">
                تم إخفاء الأقسام التالية تلقائياً من الموقع الحي لعدم إضافة محتوى فيها بعد:{' '}
                <strong className="fs-accent-text">
                  {hiddenEmptySectionsForOwner
                    .map((k) => PORTAL_SECTION_LABELS[k])
                    .join(' · ')}
                </strong>
                . ستظهر فوراً بتصميمها الكامل بمجرد إضافة أول عنصر فيها من لوحة «موقعي».
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ================================================================= */}
      {/* 4. LUXURY BESPOKE PORTAL FOOTER                                   */}
      {/* ================================================================= */}
      <footer className="fs-hero border-t border-white/10 mt-10">
        <div
          className={`${
            compactPreview
              ? 'px-5 py-8'
              : 'max-w-6xl mx-auto px-5 sm:px-8 py-12'
          } grid grid-cols-1 md:grid-cols-12 gap-8 items-center`}
        >
          <div className="md:col-span-5 flex items-center gap-4">
            <FamilyCrestEmblem
              familyName={siteData.familyName}
              crestMode={branding.crestMode}
              crestStyle={branding.crestStyle}
              customCrestUrl={branding.customCrestUrl}
              size="sm"
            />
            <div className="space-y-1">
              <div className="text-base font-bold fs-display-font">
                {portalTitle}
              </div>
              <div className="text-xs opacity-75">
                {[siteData.originRegion, siteData.originCountry]
                  .filter(Boolean)
                  .join(' — ')}
              </div>
            </div>
          </div>

          <div className="md:col-span-4 flex flex-wrap gap-x-4 gap-y-2 text-xs opacity-85">
            {orderedActiveSections.slice(0, 6).map((secKey) => (
              <button
                key={secKey}
                type="button"
                onClick={() => scrollToSection(secKey)}
                className="hover:underline cursor-pointer"
              >
                {SECTION_SHORT_NAV[secKey]}
              </button>
            ))}
          </div>

          <div className="md:col-span-3 flex md:justify-end">
            {!compactPreview && (
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Share2 className="w-4 h-4 fs-gold-text" />
                <span>بطاقة الدعوة ورمز QR</span>
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 py-4 px-5 text-center text-[11px] opacity-75 flex flex-wrap items-center justify-center gap-2">
          <Scroll className="w-3.5 h-3.5 fs-gold-text" />
          <span>
            بوابة عائلية موثّقة رقمياً عبر منصة «جذوري» للأنساب والإرث العائلي العربي · {ACTIVE_PUBLIC_SITE_DISPLAY_HOST}/{siteData.siteSlug}
          </span>
        </div>
      </footer>

      {/* ================================================================= */}
      {/* MODALS: VAULT LIGHTBOX, ENRICHMENT PROPOSAL, QR CARD, INVITE CLAIM */}
      {/* ================================================================= */}
      {lightboxVaultItem && !compactPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLightboxVaultItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl rounded-3xl fs-surface border fs-border overflow-hidden shadow-2xl"
          >
            <div className="bg-[#161412] flex items-center justify-center p-4 relative max-h-[70vh]">
              {lightboxVaultItem.previewUrl ? (
                <img
                  src={lightboxVaultItem.previewUrl}
                  alt={lightboxVaultItem.title}
                  referrerPolicy="no-referrer"
                  className="max-h-[65vh] w-auto object-contain rounded-xl"
                />
              ) : (
                <FileText className="w-16 h-16 fs-gold-text" />
              )}
              <button
                type="button"
                onClick={() => setLightboxVaultItem(null)}
                className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/65 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold fs-display-font">
                  {lightboxVaultItem.title}
                </h3>
                <div className="text-xs fs-muted mt-0.5">
                  {lightboxVaultItem.dateOrOccasion}
                  {lightboxVaultItem.watermarkText
                    ? ` · ${lightboxVaultItem.watermarkText}`
                    : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEnrichmentModal && !compactPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-3xl fs-surface border fs-border p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b fs-border pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 fs-accent-text" />
                <h3 className="text-base font-bold fs-display-font">
                  اقتراح إثراء لبوابة عائلة {siteData.familyName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEnrichmentModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-black/5 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {enrSuccessMessage ? (
              <div className="rounded-2xl fs-surface-alt border fs-border p-5 text-center space-y-3">
                <CheckCircle2 className="w-8 h-8 fs-accent-text mx-auto" />
                <p className="text-xs sm:text-sm font-bold leading-relaxed">
                  {enrSuccessMessage}
                </p>
                <button
                  type="button"
                  onClick={() => setShowEnrichmentModal(false)}
                  className="px-5 py-2 rounded-xl fs-accent-bg text-xs font-bold cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitEnrichment} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEnrType('ADD_TREE_MEMBER')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                      enrType === 'ADD_TREE_MEMBER'
                        ? 'fs-accent-bg'
                        : 'fs-surface-alt fs-border'
                    }`}
                  >
                    إضافة فرد أو فرع
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnrType('VAULT_MEDIA')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                      enrType === 'VAULT_MEDIA'
                        ? 'fs-accent-bg'
                        : 'fs-surface-alt fs-border'
                    }`}
                  >
                    إهداء صورة للخزانة
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={enrRequesterName}
                    onChange={(e) => setEnrRequesterName(e.target.value)}
                    placeholder="اسمك الكامل *"
                    className="px-3 py-2 rounded-xl fs-surface-alt border fs-border text-xs"
                  />
                  <input
                    type="text"
                    value={enrKinship}
                    onChange={(e) => setEnrKinship(e.target.value)}
                    placeholder="صلة القرابة"
                    className="px-3 py-2 rounded-xl fs-surface-alt border fs-border text-xs"
                  />
                </div>

                {enrType === 'ADD_TREE_MEMBER' ? (
                  <>
                    <select
                      value={enrTargetPersonId}
                      onChange={(e) => setEnrTargetPersonId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl fs-surface-alt border fs-border text-xs"
                    >
                      <option value="">يتبع لمن في الشجرة؟ (اختياري)</option>
                      {treeMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.displayName} ({m.relationLabel})
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        value={enrProposedFirstName}
                        onChange={(e) =>
                          setEnrProposedFirstName(e.target.value)
                        }
                        placeholder="اسم الفرد المقترح *"
                        className="px-3 py-2 rounded-xl fs-surface-alt border fs-border text-xs"
                      />
                      <select
                        value={enrProposedGender}
                        onChange={(e) =>
                          setEnrProposedGender(
                            e.target.value as 'male' | 'female'
                          )
                        }
                        className="px-3 py-2 rounded-xl fs-surface-alt border fs-border text-xs"
                      >
                        <option value="male">ذكر</option>
                        <option value="female">أنثى</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={enrProposedBirthYear}
                        onChange={(e) =>
                          setEnrProposedBirthYear(e.target.value)
                        }
                        placeholder="سنة الميلاد (اختياري)"
                        className="px-3 py-2 rounded-xl fs-surface-alt border fs-border text-xs"
                      />
                      <input
                        type="text"
                        value={enrProposedBirthPlace}
                        onChange={(e) =>
                          setEnrProposedBirthPlace(e.target.value)
                        }
                        placeholder="المدينة (اختياري)"
                        className="px-3 py-2 rounded-xl fs-surface-alt border fs-border text-xs"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      required
                      value={enrMediaTitle}
                      onChange={(e) => setEnrMediaTitle(e.target.value)}
                      placeholder="عنوان الصورة أو الوثيقة *"
                      className="w-full px-3 py-2 rounded-xl fs-surface-alt border fs-border text-xs"
                    />
                    <input
                      type="text"
                      value={enrMediaOccasion}
                      onChange={(e) => setEnrMediaOccasion(e.target.value)}
                      placeholder="السنة أو المناسبة"
                      className="w-full px-3 py-2 rounded-xl fs-surface-alt border fs-border text-xs"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEnrichmentMediaUpload}
                      className="w-full text-xs"
                    />
                  </>
                )}

                <textarea
                  rows={2}
                  value={enrNotes}
                  onChange={(e) => setEnrNotes(e.target.value)}
                  placeholder="ملاحظات إضافية لأمين السجل..."
                  className="w-full px-3 py-2 rounded-xl fs-surface-alt border fs-border text-xs"
                />

                <button
                  type="submit"
                  disabled={enrSubmitting}
                  className="w-full py-2.5 rounded-xl fs-accent-bg text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {enrSubmitting
                    ? 'جاري إرسال المقترح...'
                    : 'رفع المقترح لاعتماد أمين السجل'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {showQrModal && !compactPreview && (
        <RoyalQrInvitationModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          familyName={siteData.familyName}
          siteSlug={siteData.siteSlug}
          referralCode={siteData.ownerReferralCode || ''}
          registrarName={siteData.ownerDisplayName || siteData.familyName}
          emblemTag={siteData.familyEmblemTag}
        />
      )}

      {showInviteClaimModal && activeInvitation && !compactPreview && (
        <KinshipInviteClaimModal
          isOpen={showInviteClaimModal}
          invitation={activeInvitation}
          onClose={() => setShowInviteClaimModal(false)}
          onClaimCompleted={handleInviteClaimSuccess}
        />
      )}
    </div>
  );
};
