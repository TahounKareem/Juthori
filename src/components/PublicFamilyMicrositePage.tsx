import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  EyeOff,
  FileText,
  GitBranch,
  Globe,
  Heart,
  HelpCircle,
  Landmark,
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
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { processMediaFileForUpload } from '../utils/mediaPipeline';
import { RoyalQrInvitationModal } from './RoyalQrInvitationModal';
import { CANONICAL_BRAND_DISPLAY_HOST } from '../config/referralAndSiteConfig';
import {
  ClaimedKinshipSessionPayload,
  KinshipInviteClaimModal,
} from './KinshipInviteClaimModal';
import {
  FamilyCrestEmblem,
  HeritagePavilionHeader,
  HeritageSectionPavilion,
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

const INVALID_LOCATION_TOKENS = new Set([
  'غير محدد',
  'غير محددة',
  'غير معروف',
  'غير معروفة',
  '—',
  '-',
  'none',
  'n/a',
  'unknown',
]);

const AUDIO_WAVEFORM_HEIGHTS = [
  34, 58, 44, 84, 64, 96, 52, 78, 90, 48, 72, 92, 56, 70, 42, 62,
];

function cleanLocationField(raw?: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed || INVALID_LOCATION_TOKENS.has(trimmed.toLowerCase())) {
    return '';
  }
  return trimmed;
}

function formatCleanLocation(...parts: Array<string | undefined>): string {
  return parts
    .map((p) => cleanLocationField(p))
    .filter(Boolean)
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .join(' — ');
}

function sanitizePublicBio(raw?: string): string {
  if (!raw) return '';
  let text = raw.trim();
  // Remove duplicated parenthetical country/region like `في العراق (العراق)` -> `في العراق`
  text = text.replace(
    /([\u0600-\u06FFa-zA-Z]+(?:\s+[\u0600-\u06FFa-zA-Z]+){0,2})\s*\(\s*\1\s*\)/g,
    '$1'
  );
  // Strip any raw `غير محدد` / `غير محددة` tokens and dangling separators
  text = text.replace(/\(\s*غير\s+محدد[ة]?\s*\)/g, '');
  text = text.replace(/غير\s+محدد[ة]?\s*[—·-]\s*/g, '');
  text = text.replace(/\s*[—·-]\s*غير\s+محدد[ة]?/g, '');
  text = text.replace(/\s+في\s+غير\s+محدد[ة]?/g, '');
  text = text.replace(/غير\s+محدد[ة]?/g, '');
  return text.replace(/\s{2,}/g, ' ').trim();
}

function formatArabicLongDate(raw?: string): string {
  const val = (raw || '').trim();
  if (!val) return '';
  const isoMatch = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!isoMatch) return val;
  const year = Number(isoMatch[1]);
  const month = Number(isoMatch[2]);
  const day = Number(isoMatch[3]);
  const dt = new Date(year, month - 1, day);
  if (Number.isNaN(dt.getTime())) return val;
  try {
    const formatted = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(dt);
    return formatted.includes('م') ? formatted : `${formatted} م`;
  } catch {
    return val;
  }
}

function getAdaptiveGridClass(
  count: number,
  compactPreview: boolean,
  maxCols: 2 | 3 = 3
): string {
  if (count <= 1) return 'grid grid-cols-1 gap-5';
  if (compactPreview) {
    return maxCols === 3
      ? 'grid grid-cols-1 sm:grid-cols-2 gap-3.5'
      : 'grid grid-cols-1 gap-3.5';
  }
  if (count === 2 || maxCols === 2) {
    return 'grid grid-cols-1 md:grid-cols-2 gap-5';
  }
  return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5';
}

function getArabicMonogram(name?: string): string {
  const cleaned = (name || '')
    .trim()
    .replace(/^(د\.|أ\.|م\.|الشيخ|المهندس|الدكتور|الأستاذ|الحاج)\s+/u, '')
    .trim();
  return (cleaned[0] || 'ع').toUpperCase();
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

  // Bespoke Micro-Interaction States (Scroll-Spy, Prayer Warm Glow, Event Details Copy)
  const [activeNavSection, setActiveNavSection] =
    useState<PortalSectionKey | null>(null);
  const [prayedElderIds, setPrayedElderIds] = useState<Record<string, boolean>>(
    {}
  );
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);

  // Live ticker for countdowns (Events & Time Capsule)
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Scroll-Spy observer for Warm Glass Sticky Navbar active section highlight
  useEffect(() => {
    if (compactPreview || typeof window === 'undefined') return;
    if (typeof IntersectionObserver === 'undefined') return;
    const sectionEls = Array.from(
      document.querySelectorAll<HTMLElement>('[id^="portal-sec-"]')
    );
    if (sectionEls.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          const rawId = visible[0].target.id.replace('portal-sec-', '');
          setActiveNavSection(rawId as PortalSectionKey);
        }
      },
      { rootMargin: '-22% 0px -58% 0px', threshold: [0.1, 0.35, 0.6] }
    );

    sectionEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [compactPreview, siteData]);

  const [authSyncKey, setAuthSyncKey] = useState<string>(() =>
    auth.currentUser?.uid || 'guest'
  );
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthSyncKey(u?.uid || 'guest');
    });
    return () => unsub();
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
  }, [siteSlug, previewData, authSyncKey]);

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
  ): {
    expired: boolean;
    days: number;
    hours: number;
    minutes: number;
    label: string;
  } => {
    const targetMs = new Date(isoDate).getTime();
    if (Number.isNaN(targetMs)) {
      return { expired: false, days: 0, hours: 0, minutes: 0, label: isoDate };
    }
    const diff = targetMs - nowTick;
    if (diff <= 0) {
      return {
        expired: true,
        days: 0,
        hours: 0,
        minutes: 0,
        label: 'حان الموعد · متاح الآن',
      };
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    return {
      expired: false,
      days,
      hours,
      minutes,
      label: `متبقٍّ ${days} يوم · ${hours} ساعة · ${minutes} دقيقة`,
    };
  };

  const handleCopyEventDetails = (ev: {
    id: string;
    title: string;
    eventDateIso: string;
    locationLabel: string;
    hostNote?: string;
  }) => {
    const formattedDate = formatArabicLongDate(ev.eventDateIso);
    const lines = [
      `✦ ${ev.title}`,
      `التاريخ: ${formattedDate}`,
      ev.locationLabel ? `الموقع: ${ev.locationLabel}` : '',
      ev.hostNote ? `ملاحظة: ${ev.hostNote}` : '',
    ].filter(Boolean);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
    }
    setCopiedEventId(ev.id);
    window.setTimeout(() => {
      setCopiedEventId((prev) => (prev === ev.id ? null : prev));
    }, 2200);
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
            <span dir="ltr" className="font-mono font-semibold inline-block">
              {CANONICAL_BRAND_DISPLAY_HOST}/{siteSlug}
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

  // Real Heritage Metrics for Floating Stats Bar (Zero-Free Policy)
  const generationsCount =
    siteData.treeMetrics?.generationsCount ||
    new Set(treeMembers.map((m) => m.generationLevel)).size;
  const membersCount =
    siteData.treeMetrics?.totalContemporaryMembers || treeMembers.length;
  const locationsCount = cms.atlasAndStatsModule.locations.length;
  const vaultCount = vaultItems.length;

  const floatingMetrics: Array<{
    key: string;
    value: string | number;
    label: string;
    isSeal?: boolean;
  }> = [];
  if (membersCount > 0) {
    floatingMetrics.push({
      key: 'members',
      value: membersCount,
      label: 'أفراد العائلة الموثقون',
    });
  }
  if (generationsCount > 0) {
    floatingMetrics.push({
      key: 'generations',
      value: generationsCount,
      label: 'الأجيال المتصلة',
    });
  }
  if (vaultCount > 0) {
    floatingMetrics.push({
      key: 'vault',
      value: vaultCount,
      label: 'مقتنيات الخزانة المعروضة',
    });
  }
  if (locationsCount > 0) {
    floatingMetrics.push({
      key: 'locations',
      value: locationsCount,
      label: 'الديار والحواضر',
    });
  }
  if (floatingMetrics.length < 4) {
    floatingMetrics.push({
      key: 'verified_status',
      value: 'موثّق ✦',
      label: siteData.isRegistrarCertified
        ? 'سجل عائلي معتمد'
        : 'بوابة عائلية رسمية',
      isSeal: true,
    });
  }

  const portalTitle =
    siteData.bioTitle?.trim() || `ديوان عائلة ${siteData.familyName}`;
  const cleanHeroLocation = formatCleanLocation(
    siteData.originRegion,
    siteData.originCountry
  );
  const sanitizedHeroBio = sanitizePublicBio(siteData.bioDescription);

  const scrollToSection = (key: PortalSectionKey) => {
    if (compactPreview) return;
    setActiveNavSection(key);
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
    setPrayedElderIds((prev) => ({ ...prev, [elderId]: true }));
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
  // SECTION RENDERER BY ORDERED SECTION KEY (FRAMED HERITAGE PAVILIONS)
  // ===========================================================================
  const renderSectionByKey = (key: PortalSectionKey): React.ReactNode => {
    switch (key) {
      // 1. PATRIARCH WELCOME QUOTE
      case 'patriarch_quote':
        return (
          <HeritageSectionPavilion
            key={key}
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
            watermarkVariant="manuscript"
          >
            <div className="py-2 sm:py-4 text-center flex flex-col items-center space-y-5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center border shadow-xs"
                style={{
                  backgroundColor: 'var(--fs-gold-soft)',
                  borderColor:
                    'color-mix(in srgb, var(--fs-gold) 48%, transparent)',
                  color: 'var(--fs-accent)',
                }}
              >
                <Quote className="w-5 h-5" />
              </div>

              <div className="text-[11px] font-bold tracking-wide fs-accent-text">
                كلمة عميد ومؤسس الديوان العائلي
              </div>

              <blockquote className="max-w-3xl mx-auto text-lg sm:text-2xl lg:text-[26px] leading-relaxed sm:leading-loose fs-display-font font-bold">
                <span className="fs-gold-text ml-1.5">«</span>
                {branding.patriarchQuote.text.trim()}
                <span className="fs-gold-text mr-1.5">»</span>
              </blockquote>

              <div className="w-28 flex items-center gap-2" aria-hidden="true">
                <div
                  className="h-px flex-1"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, var(--fs-gold))',
                  }}
                />
                <span className="text-[10px] fs-gold-text">✦</span>
                <div
                  className="h-px flex-1"
                  style={{
                    background:
                      'linear-gradient(270deg, transparent, var(--fs-gold))',
                  }}
                />
              </div>

              <div className="flex flex-col items-center gap-0.5">
                <div className="text-sm sm:text-base font-bold fs-accent-text fs-display-font">
                  {branding.patriarchQuote.authorName}
                </div>
                {branding.patriarchQuote.authorTitle && (
                  <div className="text-xs fs-muted">
                    {branding.patriarchQuote.authorTitle}
                  </div>
                )}
              </div>
            </div>
          </HeritageSectionPavilion>
        );

      // 2. INTERACTIVE VISUAL TREE MIRROR
      case 'tree_mirror':
        return (
          <HeritageSectionPavilion
            key={key}
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
          >
            <HeritagePavilionHeader
              kicker="مشجرة الأجيال المعاصرة"
              title={`مرآة شجرة عائلة ${siteData.familyName}`}
              subtitle="استعرض فروع العائلة وأجيالها المتصلة عبر لوحة المشجرة التفاعلية بالسحب والتكبير."
              icon={<GitBranch className="w-3.5 h-3.5" />}
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
          </HeritageSectionPavilion>
        );

      // 3. MUSEUM VAULT GALLERY + LIGHTBOX
      case 'vault_gallery': {
        const isSingleVault = vaultItems.length === 1 && !compactPreview;
        return (
          <HeritageSectionPavilion
            key={key}
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
          >
            <HeritagePavilionHeader
              kicker="مقتنيات أرشيفية مختارة"
              title="معرض خزانة الصور والوثائق"
              icon={<Camera className="w-3.5 h-3.5" />}
              action={
                !compactPreview ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEnrType('VAULT_MEDIA');
                      setEnrSuccessMessage(null);
                      setShowEnrichmentModal(true);
                    }}
                    className="px-3.5 py-2 rounded-xl fs-surface border text-xs font-bold fs-accent-text cursor-pointer hover:opacity-90 transition-opacity shadow-2xs"
                    style={{
                      borderColor:
                        'color-mix(in srgb, var(--fs-gold) 45%, transparent)',
                    }}
                  >
                    + إهداء صورة للخزانة
                  </button>
                ) : undefined
              }
            />

            <div
              className={getAdaptiveGridClass(
                vaultItems.length,
                compactPreview,
                3
              )}
            >
              {vaultItems.map((item) => (
                <article
                  key={item.id}
                  className={`group rounded-2xl fs-surface border fs-border overflow-hidden shadow-xs hover:shadow-md transition-all ${
                    isSingleVault
                      ? 'grid grid-cols-1 md:grid-cols-12'
                      : 'flex flex-col'
                  }`}
                >
                  <div
                    onClick={() => !compactPreview && setLightboxVaultItem(item)}
                    className={`relative fs-surface-alt overflow-hidden cursor-pointer flex items-center justify-center ${
                      isSingleVault
                        ? 'md:col-span-7 aspect-[16/10] md:aspect-auto md:min-h-[300px]'
                        : 'aspect-[4/3]'
                    }`}
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
                      <div className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-md bg-black/50 backdrop-blur-xs text-[10px] text-white/90 font-semibold pointer-events-none">
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

                  <div
                    className={`${
                      isSingleVault ? 'md:col-span-5 p-6 sm:p-7' : 'p-4'
                    } flex-1 flex flex-col justify-between gap-3`}
                  >
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold fs-accent-text">
                        {item.mediaType === 'document'
                          ? 'وثيقة أرشيفية'
                          : 'صورة تراثية'}
                      </div>
                      <h3
                        className={`${
                          isSingleVault ? 'text-lg sm:text-xl' : 'text-sm'
                        } font-bold fs-display-font line-clamp-2`}
                      >
                        {item.title}
                      </h3>
                      <div className="text-xs fs-muted tabular-nums">
                        {formatArabicLongDate(item.dateOrOccasion)}
                      </div>
                    </div>

                    {siteData.privacyConfig.enablePhotoFacePrompt &&
                      !compactPreview && (
                        <div className="pt-3 border-t fs-border space-y-2">
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
                              هل تعرف شخصاً في هذه الصورة؟ (
                              {item.faceIdNotes?.length || 0})
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
          </HeritageSectionPavilion>
        );
      }

      // 4. FAMILY NEWS & BLESSINGS
      case 'news': {
        const isSingleNews =
          cms.newsModule.items.length === 1 && !compactPreview;
        return (
          <HeritageSectionPavilion
            key={key}
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
          >
            <HeritagePavilionHeader
              kicker="تباشير وأفراح العائلة"
              title="أخبار ومستجدات العائلة"
              icon={<Sparkles className="w-3.5 h-3.5" />}
            />
            <div
              className={getAdaptiveGridClass(
                cms.newsModule.items.length,
                compactPreview,
                2
              )}
            >
              {cms.newsModule.items.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-2xl fs-surface border fs-border overflow-hidden shadow-xs ${
                    isSingleNews && item.imageUrl
                      ? 'grid grid-cols-1 md:grid-cols-12'
                      : 'flex flex-col justify-between'
                  }`}
                >
                  {item.imageUrl && (
                    <div
                      className={`overflow-hidden fs-surface-alt ${
                        isSingleNews
                          ? 'md:col-span-5 aspect-[16/10] md:aspect-auto md:min-h-[240px] border-b md:border-b-0 md:border-l fs-border'
                          : 'aspect-[16/9] w-full border-b fs-border'
                      }`}
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div
                    className={`${
                      isSingleNews && item.imageUrl
                        ? 'md:col-span-7 p-6 sm:p-7'
                        : 'p-5 sm:p-6'
                    } space-y-3.5 flex-1 flex flex-col justify-between`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span
                          className="px-2.5 py-0.5 rounded-md font-bold fs-accent-text border"
                          style={{
                            backgroundColor: 'var(--fs-gold-soft)',
                            borderColor:
                              'color-mix(in srgb, var(--fs-gold) 35%, transparent)',
                          }}
                        >
                          {item.category}
                        </span>
                        <span className="fs-muted tabular-nums">
                          {formatArabicLongDate(item.dateLabel)}
                        </span>
                      </div>
                      <h3
                        className={`${
                          isSingleNews ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'
                        } font-bold fs-display-font`}
                      >
                        {item.title}
                      </h3>
                      <p className="text-xs sm:text-sm fs-muted leading-relaxed">
                        {item.summary}
                      </p>
                    </div>

                    <div className="pt-3.5 border-t fs-border space-y-2.5">
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
          </HeritageSectionPavilion>
        );
      }

      // 5. EVENTS WITH LIVE COUNTDOWN (DAYS, HOURS, MINUTES) + COPY + RSVP
      case 'events': {
        const isSingleEvent =
          cms.eventsModule.items.length === 1 && !compactPreview;
        return (
          <HeritageSectionPavilion
            key={key}
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
          >
            <HeritagePavilionHeader
              kicker="لقاءات وصلة رحم"
              title="المناسبات والملتقيات القادمة"
              icon={<Calendar className="w-3.5 h-3.5" />}
            />
            <div
              className={getAdaptiveGridClass(
                cms.eventsModule.items.length,
                compactPreview,
                2
              )}
            >
              {cms.eventsModule.items.map((ev) => {
                const cd = formatCountdownParts(ev.eventDateIso);
                const formattedEventDate = formatArabicLongDate(ev.eventDateIso);
                const attendingTotal = (ev.rsvps || [])
                  .filter((r) => r.status === 'attending')
                  .reduce((sum, r) => sum + 1 + (r.companionsCount || 0), 0);
                const isCopied = copiedEventId === ev.id;
                return (
                  <article
                    key={ev.id}
                    className={`rounded-2xl fs-surface border p-5 sm:p-6 space-y-4 shadow-xs relative overflow-hidden ${
                      isSingleEvent ? 'sm:p-7' : ''
                    }`}
                    style={{
                      borderColor:
                        'color-mix(in srgb, var(--fs-gold) 36%, transparent)',
                    }}
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-0 h-1 fs-accent-gold-bar opacity-80"
                    />

                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-1">
                      <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold fs-accent-text">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formattedEventDate}</span>
                        </div>
                        <h3
                          className={`${
                            isSingleEvent
                              ? 'text-lg sm:text-xl'
                              : 'text-base sm:text-lg'
                          } font-bold fs-display-font`}
                        >
                          {ev.title}
                        </h3>
                        {cleanLocationField(ev.locationLabel) && (
                          <div className="text-xs fs-muted flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 fs-accent-text shrink-0" />
                            <span>{cleanLocationField(ev.locationLabel)}</span>
                          </div>
                        )}
                      </div>

                      {!cd.expired && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {[
                            { val: cd.days, lbl: 'يوم' },
                            { val: cd.hours, lbl: 'ساعة' },
                            { val: cd.minutes, lbl: 'دقيقة' },
                          ].map((unit) => (
                            <div
                              key={unit.lbl}
                              className="px-2.5 py-2 rounded-xl fs-surface-alt border text-center min-w-[50px]"
                              style={{
                                borderColor:
                                  'color-mix(in srgb, var(--fs-gold) 38%, transparent)',
                              }}
                            >
                              <div className="text-sm font-bold fs-accent-text tabular-nums leading-none">
                                {unit.val}
                              </div>
                              <div className="text-[9.5px] fs-muted mt-1">
                                {unit.lbl}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {ev.hostNote && (
                      <p className="text-xs sm:text-sm fs-muted leading-relaxed">
                        {ev.hostNote}
                      </p>
                    )}

                    <div className="pt-3.5 border-t fs-border flex flex-wrap items-center justify-between gap-2.5">
                      <span className="text-xs font-semibold fs-muted tabular-nums">
                        {attendingTotal > 0
                          ? `المؤكد حضورهم: ${attendingTotal}`
                          : 'الدعوة مفتوحة لأفراد العائلة الكرام'}
                      </span>
                      {!compactPreview && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyEventDetails(ev)}
                            className="px-3 py-1.5 rounded-xl fs-surface-alt border fs-border text-xs font-bold fs-accent-text inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>تم النسخ</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>نسخ تفاصيل الموعد</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setRsvpOpenEventId(
                                rsvpOpenEventId === ev.id ? null : ev.id
                              )
                            }
                            className="px-3.5 py-1.5 rounded-xl fs-accent-bg text-xs font-bold cursor-pointer hover:opacity-95 transition-opacity"
                          >
                            تأكيد الحضور (RSVP)
                          </button>
                        </div>
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
                            <option value="apologizing">
                              أعتذر مع التمنيات بالتوفيق
                            </option>
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
          </HeritageSectionPavilion>
        );
      }

      // 6. ANCESTOR STORIES & MEMORIES
      case 'stories': {
        const isSingleStory =
          cms.storiesModule.items.length === 1 && !compactPreview;
        return (
          <HeritageSectionPavilion
            key={key}
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
            watermarkVariant="manuscript"
          >
            <HeritagePavilionHeader
              kicker="سِير ومواقف خالدة"
              title="قصص الأجداد وذاكرة العائلة"
              icon={<BookOpen className="w-3.5 h-3.5" />}
            />
            <div
              className={getAdaptiveGridClass(
                cms.storiesModule.items.length,
                compactPreview,
                2
              )}
            >
              {cms.storiesModule.items.map((st) => (
                <article
                  key={st.id}
                  className={`rounded-2xl fs-surface border fs-border overflow-hidden shadow-xs ${
                    isSingleStory && st.imageUrl
                      ? 'grid grid-cols-1 md:grid-cols-12'
                      : 'flex flex-col'
                  }`}
                >
                  {st.imageUrl && (
                    <div
                      className={`overflow-hidden fs-surface-alt ${
                        isSingleStory
                          ? 'md:col-span-5 aspect-[16/10] md:aspect-auto md:min-h-[260px] border-b md:border-b-0 md:border-l fs-border'
                          : 'aspect-[16/9] w-full border-b fs-border'
                      }`}
                    >
                      <img
                        src={st.imageUrl}
                        alt={st.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div
                    className={`${
                      isSingleStory && st.imageUrl
                        ? 'md:col-span-7 p-6 sm:p-8'
                        : 'p-6'
                    } space-y-2.5 flex-1`}
                  >
                    <div className="text-xs font-bold fs-accent-text tabular-nums">
                      {formatArabicLongDate(st.eraOrYearLabel)}
                    </div>
                    <h3
                      className={`${
                        isSingleStory ? 'text-xl sm:text-2xl' : 'text-lg'
                      } font-bold fs-display-font`}
                    >
                      {st.title}
                    </h3>
                    <p className="text-xs sm:text-sm fs-muted leading-loose whitespace-pre-line max-w-2xl">
                      {st.body}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </HeritageSectionPavilion>
        );
      }

      // 7. HALL OF FAME / NOTABLES
      case 'notables': {
        const isSingleNotable =
          cms.notablesModule.items.length === 1 && !compactPreview;
        return (
          <HeritageSectionPavilion
            key={key}
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
          >
            <HeritagePavilionHeader
              kicker="أعلام وإنجازات مشرّفة"
              title={`لوحة شرف عائلة ${siteData.familyName}`}
              icon={<Award className="w-3.5 h-3.5" />}
            />
            <div
              className={getAdaptiveGridClass(
                cms.notablesModule.items.length,
                compactPreview,
                3
              )}
            >
              {cms.notablesModule.items.map((n) => (
                <article
                  key={n.id}
                  className={`rounded-2xl fs-surface border fs-border shadow-xs hover:shadow-md transition-shadow ${
                    isSingleNotable
                      ? 'p-6 sm:p-7 flex flex-col md:flex-row md:items-center gap-6'
                      : 'p-5 space-y-3'
                  }`}
                >
                  <div
                    className={`flex items-center gap-3.5 ${
                      isSingleNotable ? 'md:w-5/12 shrink-0' : ''
                    }`}
                  >
                    <div
                      className={`${
                        isSingleNotable ? 'w-16 h-16' : 'w-14 h-14'
                      } rounded-2xl overflow-hidden border-2 flex items-center justify-center shrink-0 shadow-xs`}
                      style={{
                        borderColor: 'var(--fs-gold)',
                        background:
                          'linear-gradient(145deg, var(--fs-hero-bg) 0%, var(--fs-hero-bg-deep, var(--fs-hero-bg)) 100%)',
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
                    <div className="min-w-0 space-y-0.5">
                      <h3
                        className={`${
                          isSingleNotable ? 'text-lg' : 'text-base'
                        } font-bold fs-display-font truncate`}
                      >
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
                  <p
                    className={`text-xs sm:text-sm fs-muted leading-relaxed ${
                      isSingleNotable
                        ? 'md:border-r md:pr-6 pt-3 md:pt-0 border-t md:border-t-0 fs-border flex-1'
                        : 'pt-2.5 border-t fs-border'
                    }`}
                  >
                    {n.achievementSummary}
                  </p>
                </article>
              ))}
            </div>
          </HeritageSectionPavilion>
        );
      }

      // 8. ATLAS OF HOMELANDS (COMPASS WATERMARK + SHARE % + THEME-GOLD BAR)
      case 'atlas': {
        const locations = cms.atlasAndStatsModule.locations;
        const maxLoc = Math.max(
          1,
          ...locations.map((l) => l.householdsOrMembersCount || 1)
        );
        const totalLoc = Math.max(
          1,
          locations.reduce((s, l) => s + (l.householdsOrMembersCount || 1), 0)
        );
        const isSingleLoc = locations.length === 1 && !compactPreview;
        return (
          <HeritageSectionPavilion
            key={key}
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
            watermarkVariant="compass"
          >
            <HeritagePavilionHeader
              kicker="الانتشار الجغرافي والديار"
              title="أطلس ديار وحواضر العائلة"
              icon={<MapPin className="w-3.5 h-3.5" />}
            />
            <div
              className={getAdaptiveGridClass(
                locations.length,
                compactPreview,
                3
              )}
            >
              {locations.map((loc) => {
                const countVal = loc.householdsOrMembersCount || 1;
                const widthPct = Math.max(
                  14,
                  Math.round((countVal / maxLoc) * 100)
                );
                const sharePct = Math.max(
                  1,
                  Math.round((countVal / totalLoc) * 100)
                );
                const cityClean = cleanLocationField(loc.city);
                const countryClean = cleanLocationField(loc.country);
                const primaryLabel = cityClean || countryClean || 'حاضرة عائلية';
                const secondaryLabel =
                  cityClean && countryClean && cityClean !== countryClean
                    ? countryClean
                    : '';

                return (
                  <div
                    key={loc.id}
                    className={`rounded-2xl fs-surface border fs-border shadow-xs hover:shadow-md transition-shadow ${
                      isSingleLoc
                        ? 'p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5'
                        : 'p-4 sm:p-5 space-y-3.5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 flex-1">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: 'var(--fs-gold-soft)',
                            borderColor:
                              'color-mix(in srgb, var(--fs-gold) 45%, transparent)',
                            color: 'var(--fs-accent)',
                          }}
                        >
                          <Landmark className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-bold fs-display-font truncate">
                            {primaryLabel}
                          </div>
                          {secondaryLabel && (
                            <div className="text-xs fs-muted truncate">
                              {secondaryLabel}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <div className="text-sm font-bold fs-accent-text tabular-nums">
                          {countVal} عائلة/فرد
                        </div>
                        <div className="text-[11px] font-semibold fs-muted tabular-nums">
                          {sharePct}% من الحضور
                        </div>
                      </div>
                    </div>

                    <div
                      className={`space-y-1.5 ${
                        isSingleLoc ? 'sm:w-56 shrink-0' : ''
                      }`}
                    >
                      <div className="h-2 rounded-full fs-surface-alt overflow-hidden border fs-border">
                        <div
                          className="h-full rounded-full fs-accent-gold-bar transition-all duration-500"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </HeritageSectionPavilion>
        );
      }

      // 9. ORAL HERITAGE & AUDIO ARCHIVE (GOLD WAVEFORM PLAYER + CALLIGRAPHIC QUOTE)
      case 'oral_heritage': {
        const clips = cms.oralHeritageModule.items;
        const isSingleClip = clips.length === 1 && !compactPreview;
        return (
          <HeritageSectionPavilion
            key={key}
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
            watermarkVariant="manuscript"
          >
            <HeritagePavilionHeader
              kicker="أصوات وقصائد ومرويات"
              title="الموروث الصوتي والشعري"
              icon={<Mic className="w-3.5 h-3.5" />}
            />
            <div
              className={getAdaptiveGridClass(clips.length, compactPreview, 2)}
            >
              {clips.map((clip) => {
                const isPlaying = playingClipId === clip.id;
                const hasAudio = Boolean(clip.audioDataOrUrl);
                return (
                  <article
                    key={clip.id}
                    className={`rounded-2xl fs-surface border p-5 sm:p-6 shadow-xs transition-shadow hover:shadow-md ${
                      isSingleClip
                        ? 'grid grid-cols-1 md:grid-cols-12 gap-6 items-center'
                        : 'space-y-4'
                    }`}
                    style={{
                      borderColor: isPlaying
                        ? 'var(--fs-gold)'
                        : 'var(--fs-border)',
                    }}
                  >
                    <div
                      className={`${
                        isSingleClip ? 'md:col-span-6' : ''
                      } space-y-3.5`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <button
                            type="button"
                            disabled={!hasAudio}
                            onClick={() =>
                              handleTogglePlayClip(clip.id, clip.audioDataOrUrl)
                            }
                            aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التسجيل'}
                            className="w-12 h-12 rounded-full fs-accent-bg flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-45 shadow-sm ring-2 ring-offset-2 transition-transform hover:scale-105"
                            style={{
                              ['--tw-ring-color' as string]: 'var(--fs-gold)',
                              ['--tw-ring-offset-color' as string]:
                                'var(--fs-surface)',
                            }}
                          >
                            {isPlaying ? (
                              <Pause className="w-5 h-5" />
                            ) : (
                              <Play className="w-5 h-5 mr-0.5" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-bold fs-display-font truncate">
                              {clip.title}
                            </h3>
                            <div className="text-xs fs-muted truncate mt-0.5">
                              {clip.speakerName}
                              {clip.recordedYearLabel
                                ? ` · ${clip.recordedYearLabel}`
                                : ''}
                            </div>
                          </div>
                        </div>
                        <Volume2
                          className={`w-4 h-4 shrink-0 ${
                            isPlaying
                              ? 'fs-accent-text opacity-100'
                              : 'fs-gold-text opacity-80'
                          }`}
                        />
                      </div>

                      {/* Stylized Museum Gold Audio Waveform */}
                      <div
                        className="rounded-xl fs-surface-alt border fs-border px-3.5 py-2.5 flex items-center justify-between gap-3"
                        aria-hidden="true"
                      >
                        <div className="flex items-end gap-1 h-7 flex-1">
                          {AUDIO_WAVEFORM_HEIGHTS.map((h, idx) => (
                            <span
                              key={idx}
                              className={`flex-1 rounded-full transition-all ${
                                isPlaying ? 'fs-wave-bar-playing' : ''
                              }`}
                              style={{
                                height: `${h}%`,
                                background:
                                  idx % 3 === 0
                                    ? 'var(--fs-accent)'
                                    : 'var(--fs-gold)',
                                opacity: isPlaying ? 0.95 : 0.55,
                                animationDelay: `${(idx % 6) * 0.14}s`,
                              }}
                            />
                          ))}
                        </div>
                        <span className="text-[10.5px] font-bold fs-muted shrink-0">
                          {isPlaying
                            ? 'قيد التشغيل'
                            : hasAudio
                            ? 'تسجيل موثق'
                            : 'مروية نصية'}
                        </span>
                      </div>
                    </div>

                    {clip.transcriptExcerpt && (
                      <blockquote
                        className={`${
                          isSingleClip
                            ? 'md:col-span-6 md:border-r md:pr-6 border-t md:border-t-0 pt-4 md:pt-0'
                            : 'pt-3.5 border-t'
                        } fs-border`}
                      >
                        <p className="text-sm sm:text-[15px] fs-display-font leading-loose">
                          <span className="fs-gold-text font-bold ml-1">«</span>
                          {clip.transcriptExcerpt}
                          <span className="fs-gold-text font-bold mr-1">»</span>
                        </p>
                      </blockquote>
                    )}
                  </article>
                );
              })}
            </div>
          </HeritageSectionPavilion>
        );
      }

      // 10. PROFESSIONS DIRECTORY (EXECUTIVE MONOGRAM MEDALLION CARDS)
      case 'professions': {
        const items = cms.professionsModule.items;
        const isSingleProf = items.length === 1 && !compactPreview;
        return (
          <HeritageSectionPavilion
            key={key}
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
          >
            <HeritagePavilionHeader
              kicker="التكافل والخبرات العائلية"
              title="دليل الكفاءات والتخصصات"
              icon={<Briefcase className="w-3.5 h-3.5" />}
            />
            <div
              className={getAdaptiveGridClass(items.length, compactPreview, 3)}
            >
              {items.map((prof) => {
                const monogram = getArabicMonogram(prof.memberName);
                const cleanCity = cleanLocationField(prof.cityCountryLabel);
                return (
                  <article
                    key={prof.id}
                    className={`rounded-2xl fs-surface border fs-border shadow-xs hover:shadow-md transition-all flex items-center gap-4 ${
                      isSingleProf ? 'p-6 sm:p-7' : 'p-4 sm:p-5'
                    }`}
                  >
                    {/* Gilded Circular Executive Monogram Medallion */}
                    <div
                      className={`${
                        isSingleProf ? 'w-14 h-14 text-lg' : 'w-12 h-12 text-base'
                      } rounded-full border-2 flex items-center justify-center font-bold fs-display-font shrink-0 shadow-xs`}
                      style={{
                        background:
                          'linear-gradient(145deg, var(--fs-hero-bg) 0%, var(--fs-hero-bg-deep, var(--fs-hero-bg)) 100%)',
                        borderColor: 'var(--fs-gold)',
                        color: 'var(--fs-gold)',
                      }}
                    >
                      {monogram}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="inline-block px-2 py-0.5 rounded-md text-[10.5px] font-bold fs-accent-text border"
                          style={{
                            backgroundColor: 'var(--fs-gold-soft)',
                            borderColor:
                              'color-mix(in srgb, var(--fs-gold) 36%, transparent)',
                          }}
                        >
                          {prof.fieldCategory}
                        </span>
                        {cleanCity && (
                          <span className="text-[11px] fs-muted inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 fs-gold-text" />
                            <span>{cleanCity}</span>
                          </span>
                        )}
                      </div>
                      <h3
                        className={`${
                          isSingleProf ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
                        } font-bold fs-display-font truncate`}
                      >
                        {prof.memberName}
                      </h3>
                      <div className="text-xs fs-muted leading-snug">
                        {prof.specialtyOrProfession}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </HeritageSectionPavilion>
        );
      }

      // 11. MEMORIAL CORNER & ROYAL SEALED TIME VAULT
      case 'memorial': {
        const elders = cms.memorialAndCapsuleModule.elders;
        const isSingleElder = elders.length === 1 && !compactPreview;
        const cap = cms.memorialAndCapsuleModule.timeCapsule;
        const capCountdown = cap.enabled
          ? formatCountdownParts(cap.unlockDateIso)
          : null;
        const formattedUnlockDate = formatArabicLongDate(cap.unlockDateIso);

        return (
          <HeritageSectionPavilion
            key={key}
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
            watermarkVariant="manuscript"
          >
            <HeritagePavilionHeader
              kicker="برّ ووفاء للراحلين ورسائل للأجيال"
              title="ركن الوفاء والدعاء وكبسولة الزمن"
              icon={<Heart className="w-3.5 h-3.5" />}
            />

            {elders.length > 0 && (
              <div
                className={getAdaptiveGridClass(
                  elders.length,
                  compactPreview,
                  2
                )}
              >
                {elders.map((el) => {
                  const hasPrayed = Boolean(prayedElderIds[el.id]);
                  return (
                    <article
                      key={el.id}
                      className={`rounded-2xl fs-surface border shadow-xs relative overflow-hidden ${
                        isSingleElder ? 'p-6 sm:p-7 space-y-4' : 'p-5 space-y-3.5'
                      }`}
                      style={{
                        borderColor:
                          'color-mix(in srgb, var(--fs-gold) 40%, transparent)',
                      }}
                    >
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-6 top-0 h-[1.5px]"
                        style={{
                          background:
                            'linear-gradient(90deg, transparent, var(--fs-gold), transparent)',
                        }}
                      />

                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <h3
                            className={`${
                              isSingleElder ? 'text-lg sm:text-xl' : 'text-base'
                            } font-bold fs-display-font`}
                          >
                            {el.fullName}
                          </h3>
                          <div className="text-xs fs-muted flex flex-wrap items-center gap-2">
                            <span className="font-semibold fs-accent-text">
                              رحمه الله وغفر له
                            </span>
                            {el.passingYearLabel && (
                              <>
                                <span className="opacity-45">·</span>
                                <span className="tabular-nums">
                                  {el.passingYearLabel}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handlePrayForElder(el.id)}
                            className="px-3.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer tabular-nums transition-all duration-200"
                            style={
                              hasPrayed
                                ? {
                                    backgroundColor: 'var(--fs-gold-soft)',
                                    borderColor: 'var(--fs-gold)',
                                    color: 'var(--fs-accent)',
                                    boxShadow:
                                      '0 0 18px rgba(200, 160, 84, 0.35)',
                                  }
                                : {
                                    backgroundColor: 'var(--fs-surface-alt)',
                                    borderColor: 'var(--fs-border)',
                                    color: 'var(--fs-accent)',
                                  }
                            }
                          >
                            <Heart
                              className={`w-3.5 h-3.5 ${
                                hasPrayed ? 'fill-current' : ''
                              }`}
                            />
                            <span>دعوت له ({el.prayersCount || 0})</span>
                          </button>
                          {hasPrayed && (
                            <span className="text-[10.5px] font-bold fs-accent-text">
                              تقبّل الله دعاءكم ✦
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm fs-muted leading-relaxed">
                        {el.biographyNote}
                      </p>

                      {el.ongoingCharityTitle && (
                        <div
                          className="rounded-xl fs-surface-alt border px-3.5 py-2.5 text-xs flex items-center gap-2"
                          style={{
                            borderColor:
                              'color-mix(in srgb, var(--fs-gold) 32%, transparent)',
                          }}
                        >
                          <Sparkles className="w-3.5 h-3.5 fs-gold-text shrink-0" />
                          <span>
                            <strong className="fs-accent-text">
                              الصدقة الجارية:{' '}
                            </strong>
                            {el.ongoingCharityTitle}
                          </span>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {/* ROYAL SEALED TIME VAULT */}
            {cap.enabled && cap.sealedMessage.trim() && capCountdown && (
              <div
                className="relative overflow-hidden rounded-3xl fs-hero p-6 sm:p-8 border shadow-lg"
                style={{ borderColor: 'var(--fs-gold)' }}
              >
                {/* Delicate inner frame hairline */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-2.5 rounded-2xl border opacity-25"
                  style={{ borderColor: 'var(--fs-gold)' }}
                />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    {/* Wax-Seal Time Vault Medallion */}
                    <div
                      className="w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center shrink-0 shadow-md"
                      style={{
                        borderColor: 'var(--fs-gold)',
                        background:
                          'radial-gradient(circle at 35% 30%, rgba(212,175,106,0.32), rgba(20,16,13,0.6))',
                        color: 'var(--fs-gold)',
                      }}
                    >
                      <Lock className="w-4 h-4" />
                      <span className="text-[8.5px] font-bold mt-0.5">مختوم</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold fs-gold-text">
                        <Clock className="w-3.5 h-3.5" />
                        <span>خزينة كبسولة الزمن العائلية</span>
                      </div>
                      <h3 className="text-lg sm:text-2xl font-bold fs-display-font">
                        {cap.title}
                      </h3>
                      <div className="text-xs opacity-80">
                        بقلم: {cap.authorElderName}
                      </div>
                    </div>
                  </div>

                  {/* Segmented Gilded Countdown Units */}
                  {!capCountdown.expired && (
                    <div className="flex items-center gap-2 shrink-0">
                      {[
                        { val: capCountdown.days, lbl: 'يوم' },
                        { val: capCountdown.hours, lbl: 'ساعة' },
                        { val: capCountdown.minutes, lbl: 'دقيقة' },
                      ].map((unit) => (
                        <div
                          key={unit.lbl}
                          className="px-3.5 py-2.5 rounded-2xl bg-white/8 backdrop-blur-xs border text-center min-w-[64px]"
                          style={{
                            borderColor:
                              'color-mix(in srgb, var(--fs-gold) 45%, transparent)',
                          }}
                        >
                          <div className="text-base sm:text-lg font-bold fs-gold-text tabular-nums leading-none">
                            {unit.val}
                          </div>
                          <div className="text-[10px] opacity-80 mt-1">
                            {unit.lbl}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative z-10 mt-5 pt-4 border-t border-white/15">
                  {capCountdown.expired ? (
                    <p className="text-sm sm:text-base leading-loose">
                      {cap.sealedMessage}
                    </p>
                  ) : (
                    <p className="text-xs sm:text-sm opacity-90 leading-relaxed">
                      الرسالة محفوظة ومختومة رقمياً حتى موعد الفتح الرسمي في{' '}
                      <strong className="fs-gold-text">
                        {formattedUnlockDate}
                      </strong>
                      .
                    </p>
                  )}
                </div>
              </div>
            )}
          </HeritageSectionPavilion>
        );
      }

      // 12. ELEVATED FAMILY DIWAN (GUIDED MAJLIS & GUARDIANS OF MEMORY)
      case 'majlis':
        return (
          <HeritageSectionPavilion
            key={key}
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
          >
            <HeritagePavilionHeader
              kicker="حوار العائلة وتكريم المساهمين"
              title="مجلس العائلة وحرّاس الذاكرة"
              icon={<MessageSquare className="w-3.5 h-3.5" />}
            />

            {cms.majlisAndGuardiansModule.showGuardiansHonorRoll &&
              guardians.length > 0 && (
                <div
                  className="rounded-2xl border p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--fs-gold-soft) 0%, var(--fs-surface) 100%)',
                    borderColor:
                      'color-mix(in srgb, var(--fs-gold) 42%, transparent)',
                  }}
                >
                  <div className="text-xs font-bold fs-accent-text flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 fs-gold-text" />
                    <span>وسام شرف حرّاس ذاكرة العائلة الأكثر إثراءً:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {guardians.map((g, i) => (
                      <span
                        key={`${g.name}-${i}`}
                        className="px-3 py-1 rounded-xl fs-surface border text-xs font-bold tabular-nums shadow-2xs"
                        style={{
                          borderColor:
                            'color-mix(in srgb, var(--fs-gold) 40%, transparent)',
                        }}
                      >
                        <span className="fs-gold-text ml-1">✦</span>
                        {g.name} ({g.approvedCount} إثراء)
                      </span>
                    ))}
                  </div>
                </div>
              )}

            <div className="space-y-4">
              {cms.majlisAndGuardiansModule.topics.map((topic) => (
                <article
                  key={topic.id}
                  className="rounded-2xl fs-surface border fs-border p-5 sm:p-6 space-y-4 shadow-xs"
                >
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 text-xs fs-accent-text font-bold">
                      {topic.isWeeklyElderPrompt && (
                        <Pin className="w-3.5 h-3.5 fs-gold-text" />
                      )}
                      <span>محور حوار في ديوان العائلة</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold fs-display-font">
                      {topic.title}
                    </h3>
                    <p className="text-xs sm:text-sm fs-muted leading-relaxed">
                      {topic.promptQuestion}
                    </p>
                  </div>

                  {topic.replies && topic.replies.length > 0 && (
                    <div className="space-y-2.5 pt-3 border-t fs-border">
                      {topic.replies.map((rep) => (
                        <div
                          key={rep.id}
                          className="rounded-xl fs-surface-alt border fs-border px-4 py-3 flex items-start gap-3 text-xs"
                        >
                          <div
                            className="w-8 h-8 rounded-full border flex items-center justify-center font-bold fs-display-font shrink-0 text-xs"
                            style={{
                              backgroundColor: 'var(--fs-surface)',
                              borderColor:
                                'color-mix(in srgb, var(--fs-gold) 45%, transparent)',
                              color: 'var(--fs-accent)',
                            }}
                          >
                            {getArabicMonogram(rep.authorName)}
                          </div>
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="font-bold fs-accent-text">
                              {rep.authorName}
                            </div>
                            <p className="leading-relaxed">{rep.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!topic.isLocked && !compactPreview && (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-3 border-t fs-border">
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
                        className="sm:col-span-4 px-3.5 py-2.5 rounded-xl fs-surface border fs-border text-xs focus:outline-none focus:ring-1"
                        style={{
                          ['--tw-ring-color' as string]: 'var(--fs-gold)',
                        }}
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
                        placeholder="أضف مشاركتك وذكرياتك في المجلس..."
                        className="sm:col-span-6 px-3.5 py-2.5 rounded-xl fs-surface border fs-border text-xs focus:outline-none focus:ring-1"
                        style={{
                          ['--tw-ring-color' as string]: 'var(--fs-gold)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleSubmitMajlisReply(topic.id)}
                        className="sm:col-span-2 py-2.5 px-3.5 rounded-xl fs-accent-bg text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-95 transition-opacity shadow-2xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>مشاركة</span>
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </HeritageSectionPavilion>
        );
    }
  };

  const statsGridColsClass = compactPreview
    ? floatingMetrics.length === 3
      ? 'grid-cols-3'
      : 'grid-cols-2'
    : floatingMetrics.length === 4
    ? 'grid-cols-2 md:grid-cols-4'
    : floatingMetrics.length === 3
    ? 'grid-cols-1 sm:grid-cols-3'
    : floatingMetrics.length === 2
    ? 'grid-cols-2'
    : 'grid-cols-1';

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
      {/* 1. WARM GLASS STICKY TOP NAVIGATION BAR (WITH SCROLL-SPY)         */}
      {/* ================================================================= */}
      <header
        className="sticky top-0 z-30 fs-nav-glass border-b shadow-[0_2px_16px_rgba(44,30,20,0.04)]"
        style={{
          borderColor: 'color-mix(in srgb, var(--fs-gold) 28%, transparent)',
        }}
      >
        <div
          className={`${
            compactPreview
              ? 'px-4 py-2.5'
              : 'max-w-6xl mx-auto px-4 sm:px-6 py-3'
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
            <span className="text-sm sm:text-base font-bold fs-display-font truncate">
              {portalTitle}
            </span>
          </div>

          {/* Center: Dynamic Anchor Links with Active Scroll-Spy Indicator */}
          {!compactPreview && orderedActiveSections.length > 0 && (
            <nav
              aria-label="أقسام البوابة"
              className="hidden lg:flex items-center gap-1 text-xs font-bold overflow-x-auto no-scrollbar"
            >
              {orderedActiveSections.slice(0, 7).map((secKey) => {
                const isActive = activeNavSection === secKey;
                return (
                  <button
                    key={secKey}
                    type="button"
                    onClick={() => scrollToSection(secKey)}
                    className={`relative px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'fs-accent-text'
                        : 'opacity-75 hover:opacity-100'
                    }`}
                    style={
                      isActive
                        ? { backgroundColor: 'var(--fs-gold-soft)' }
                        : undefined
                    }
                  >
                    <span>{SECTION_SHORT_NAV[secKey]}</span>
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-3 bottom-0 h-[2px] rounded-full"
                        style={{ backgroundColor: 'var(--fs-gold)' }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Left: Theme-Harmonized Share/QR + Propose Enrichment */}
          <div className="flex items-center gap-2 shrink-0">
            {!compactPreview && (
              <>
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="h-9 px-3 rounded-xl fs-surface border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 whitespace-nowrap shadow-2xs transition-opacity"
                  style={{
                    borderColor:
                      'color-mix(in srgb, var(--fs-gold) 45%, transparent)',
                  }}
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
                  className="h-9 px-3.5 rounded-xl fs-accent-bg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 whitespace-nowrap shadow-xs transition-opacity"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">اقتراح إثراء</span>
                </button>
                {!isOwnerPreview && (
                  <button
                    type="button"
                    onClick={onExitToMainApp}
                    title="منصة جذوري"
                    className="h-9 px-2.5 rounded-xl border fs-border text-xs font-bold opacity-80 hover:opacity-100 cursor-pointer whitespace-nowrap"
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
                ✦ أهلاً بك يا {justClaimedRelative.name} (
                {justClaimedRelative.kinshipRelation}) في دائرة عائلة{' '}
                {siteData.familyName} الموثقة.
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
      {/* 2. CINEMATIC HERITAGE HERO + ZERO-FREE FLOATING STATS BAR         */}
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
                {sanitizedHeroBio &&
                  siteData.privacyConfig.showBio !== false && (
                    <p
                      className={`${
                        compactPreview ? 'text-xs' : 'text-sm sm:text-base'
                      } opacity-90 leading-relaxed max-w-2xl mx-auto`}
                    >
                      {sanitizedHeroBio}
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
                {sanitizedHeroBio &&
                  siteData.privacyConfig.showBio !== false && (
                    <p className="text-sm sm:text-base opacity-90 leading-relaxed max-w-2xl">
                      {sanitizedHeroBio}
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
                    {CANONICAL_BRAND_DISPLAY_HOST}/{siteData.siteSlug}
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
              {sanitizedHeroBio &&
                siteData.privacyConfig.showBio !== false && (
                  <p className="text-xs sm:text-sm opacity-90 leading-relaxed max-w-2xl">
                    {sanitizedHeroBio}
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

      {/* FLOATING HERITAGE STATS BAR (SYMMETRICAL & ZERO-FREE) */}
      {floatingMetrics.length > 0 && (
        <div
          className={`relative z-20 ${
            compactPreview
              ? 'px-4 -mt-8'
              : 'max-w-5xl mx-auto w-full px-4 sm:px-6 -mt-10'
          }`}
        >
          <div
            className={`relative rounded-2xl fs-surface border shadow-[0_14px_38px_rgba(32,22,14,0.1)] grid ${statsGridColsClass} overflow-hidden`}
            style={{
              borderColor: 'color-mix(in srgb, var(--fs-gold) 42%, transparent)',
            }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-10 top-0 h-[1.5px]"
              style={{
                background:
                  'linear-gradient(90deg, transparent, var(--fs-gold), transparent)',
              }}
            />
            {floatingMetrics.map((metric, idx) => (
              <div
                key={metric.key}
                className={`p-4 sm:p-5 text-center flex flex-col items-center justify-center ${
                  idx < floatingMetrics.length - 1
                    ? 'border-b sm:border-b-0 sm:border-l fs-border'
                    : ''
                }`}
              >
                <div
                  className={`${
                    metric.isSeal
                      ? 'text-lg sm:text-xl'
                      : 'text-xl sm:text-2xl tabular-nums'
                  } font-bold fs-display-font fs-accent-text`}
                >
                  {metric.value}
                </div>
                <div className="text-[11px] font-bold fs-muted mt-1">
                  {metric.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. DYNAMIC ORDERED FRAMED PAVILIONS (ZERO EMPTY SECTIONS)         */}
      {/* ================================================================= */}
      <main
        className={`${
          compactPreview
            ? 'px-4 py-7 space-y-6'
            : 'max-w-6xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14 space-y-9 sm:space-y-12'
        } flex-1`}
      >
        {orderedActiveSections.map((secKey) => renderSectionByKey(secKey))}

        {/* Transparent Owner-Only Studio Note for Hidden Empty Sections */}
        {isOwnerPreview && hiddenEmptySectionsForOwner.length > 0 && (
          <div className="rounded-2xl border border-dashed fs-border fs-surface-alt/75 p-4 flex items-start gap-3 text-xs">
            <EyeOff className="w-4 h-4 fs-accent-text shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">
                ملاحظة استوديو أمين السجل (لا تظهر للزوار):
              </div>
              <p className="fs-muted leading-relaxed">
                تم إخفاء الأقسام التالية تلقائياً من الموقع الحي لعدم إضافة محتوى
                فيها بعد:{' '}
                <strong className="fs-accent-text">
                  {hiddenEmptySectionsForOwner
                    .map((k) => PORTAL_SECTION_LABELS[k])
                    .join(' · ')}
                </strong>
                . ستظهر فوراً بتصميمها الكامل بمجرد إضافة أول عنصر فيها من لوحة
                «موقعي».
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ================================================================= */}
      {/* 4. LUXURY BESPOKE PORTAL FOOTER (ZERO RAW LEAKS)                  */}
      {/* ================================================================= */}
      <footer
        className="fs-hero border-t mt-8 relative overflow-hidden"
        style={{
          borderColor: 'color-mix(in srgb, var(--fs-gold) 35%, transparent)',
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px]"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, var(--fs-gold) 50%, transparent 100%)',
          }}
        />
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
              {cleanHeroLocation && (
                <div className="text-xs opacity-80 inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 fs-gold-text" />
                  <span>{cleanHeroLocation}</span>
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-4 flex flex-wrap gap-x-4 gap-y-2 text-xs opacity-90">
            {orderedActiveSections.slice(0, 7).map((secKey) => (
              <button
                key={secKey}
                type="button"
                onClick={() => scrollToSection(secKey)}
                className="hover:underline underline-offset-4 cursor-pointer"
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
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-colors"
                style={{
                  borderColor:
                    'color-mix(in srgb, var(--fs-gold) 42%, transparent)',
                }}
              >
                <Share2 className="w-4 h-4 fs-gold-text" />
                <span>بطاقة الدعوة ورمز QR</span>
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 py-4 px-5 text-center text-[11px] opacity-80 flex flex-wrap items-center justify-center gap-2">
          <Scroll className="w-3.5 h-3.5 fs-gold-text" />
          <span>
            بوابة عائلية موثّقة رقمياً عبر منصة «جذوري» للأنساب والإرث العائلي
            العربي ·{' '}
            <span dir="ltr" className="font-mono fs-gold-text inline-block">
              {CANONICAL_BRAND_DISPLAY_HOST}/{siteData.siteSlug}
            </span>
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
