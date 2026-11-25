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
  ChevronDown,
  Clock,
  Compass,
  Copy,
  EyeOff,
  GitBranch,
  Globe,
  Heart,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  MessageSquare,
  Mic,
  Pin,
  QrCode,
  Scroll,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  Users,
  X,
} from 'lucide-react';
import {
  KinshipInvitationDoc,
  MajlisReactionKey,
  ModuleVisibility,
  PortalSectionKey,
  PublicMicrositeData,
  addBlessingToFamilyNews,
  addReplyToGuidedMajlisTopic,
  buildDefaultCmsModules,
  fetchKinshipInvitationByToken,
  fetchPublishedMicrositeBySlug,
  incrementElderMemorialPrayer,
  incrementMajlisTopicReaction,
  normalizeVisualBranding,
  restorePublishedMicrositeByPasscodeHash,
  submitEventRsvpOnMicrosite,
  submitSiteAccessRequest,
  submitTreeEnrichmentRequest,
  submitVaultPhotoFaceIdentification,
  unlockPublishedMicrositeByPasscode,
} from '../services/priority4Service';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, mirrorAuth } from '../services/firebase';
import type { UserProfileData } from '../services/firestoreService';
import type { AccountLegalType } from '../types/juthori';
import { processMediaFileForUpload } from '../utils/mediaPipeline';
import { resolvePublicSiteEnrichmentPermission } from '../utils/enrichmentStagingUtils';
import {
  SESSION_AUTHORIZED_EMAIL_KEY,
  clearAllPortalSessionUnlocks,
  evaluatePublicMicrositeAccessGate,
  readStoredPasscodeHashForSlug,
  saveStoredPasscodeHashForSlug,
} from '../utils/portalSecurityUtils';
import { RoyalQrInvitationModal } from './RoyalQrInvitationModal';
import { LoginModal } from './LoginModal';
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
import {
  AcousticVinylConsole,
  AnimatedHeritageCounter,
  CuratedMuseumVaultWall,
  FullBleedVelvetBand,
  GuildSpecialtyWatermark,
  HeritageAmbientWatermark,
  OpenEditorialCanvasSection,
  ScrollProgressGoldBar,
  ScrollRevealChapter,
  SingleEmotionalInterludeShowcase,
  StorybookReadingModal,
} from './FamilySiteEditorialPrimitives';
import { JuthoriLogo } from './JuthoriLogo';

export interface PortalLoginSuccessPayload {
  uid?: string;
  email: string;
  firstName: string;
  fatherName: string;
  grandfatherName: string;
  familyName: string;
  originCountry: string;
  originRegion?: string;
  tribeName: string;
  branchName: string;
  accountType: AccountLegalType;
  subscriptionTier?: 'free' | 'basic_verified' | 'premium_annual';
  isRootUnlocked?: boolean;
  isNewRegistration?: boolean;
  profile?: UserProfileData | null;
}

interface PublicFamilyMicrositePageProps {
  siteSlug: string;
  previewData?: PublicMicrositeData | null;
  viewerEmail?: string;
  viewerName?: string;
  viewerAvatarUrl?: string;
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
  onGoToOwnSiteSettings?: () => void;
  onPortalLoginSuccess?: (payload: PortalLoginSuccessPayload) => void;
  onPortalSignOut?: () => void;
}

const SECTION_SHORT_NAV: Record<PortalSectionKey, string> = {
  patriarch_quote: 'كلمة العميد',
  tree_mirror: 'دوحة النسب',
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

const MAJLIS_QUICK_PHRASES = [
  'بارك الله في جهودكم وجمعنا دوماً على خير',
  'فكرة رائعة ونحن معكم بإذن الله',
  'ذكريات جميلة رحم الله الأجداد وبارك في الأبناء',
];

const MAJLIS_REACTION_META: Array<{
  key: MajlisReactionKey;
  label: string;
}> = [
  { key: 'greatIdea', label: 'فكرة رائعة' },
  { key: 'withYou', label: 'معكم بإذن الله' },
  { key: 'blessGathering', label: 'جمعكم الله على خير' },
];

function parseArabicCalendarLeaf(isoDate?: string): {
  day: string;
  month: string;
  year: string;
  weekday: string;
} {
  const val = (isoDate || '').trim();
  const isoMatch = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!isoMatch) {
    return { day: '✦', month: val || 'قريباً', year: '', weekday: '' };
  }
  const y = Number(isoMatch[1]);
  const m = Number(isoMatch[2]);
  const d = Number(isoMatch[3]);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) {
    return { day: String(d), month: '', year: String(y), weekday: '' };
  }
  try {
    const month = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
      month: 'long',
    }).format(dt);
    const weekday = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
      weekday: 'long',
    }).format(dt);
    return {
      day: String(d),
      month,
      year: `${y} م`,
      weekday,
    };
  } catch {
    return { day: String(d), month: `${m}`, year: `${y} م`, weekday: '' };
  }
}

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
  viewerAvatarUrl,
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
  onGoToOwnSiteSettings,
  onPortalLoginSuccess,
  onPortalSignOut,
}) => {
  const [siteData, setSiteData] = useState<PublicMicrositeData | null>(
    previewData || null
  );
  const [loading, setLoading] = useState<boolean>(!previewData);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showPortalLoginModal, setShowPortalLoginModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement | null>(null);
  const [accessCodeBusy, setAccessCodeBusy] = useState(false);

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
  const [accessCodeInput, setAccessCodeInput] = useState<string>('');
  const [accessCodeUnlocked, setAccessCodeUnlocked] = useState<boolean>(false);
  const [accessCodeFeedback, setAccessCodeFeedback] = useState<string | null>(
    null
  );

  // Private Whitelist Access Request Form
  const [accessReqName, setAccessReqName] = useState('');
  const [accessReqEmail, setAccessReqEmail] = useState('');
  const [accessReqKinship, setAccessReqKinship] = useState('');
  const [accessReqSent, setAccessReqSent] = useState(false);
  const [accessReqBusy, setAccessReqBusy] = useState(false);

  // Dedicated Photo/Document Vault Gift Modal State
  const [showEnrichmentModal, setShowEnrichmentModal] = useState(false);
  const [enrRequesterName, setEnrRequesterName] = useState(viewerName || '');
  const [enrRequesterEmail, setEnrRequesterEmail] = useState(
    viewerEmail || activeCircleEmail || ''
  );
  const [enrKinship, setEnrKinship] = useState(viewerKinshipRelation || '');
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
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  // Full-Screen Storybook Reader Modal State
  const [readingStoryModal, setReadingStoryModal] = useState<{
    title: string;
    eraOrYearLabel: string;
    body: string;
    imageUrl?: string;
    chapterNumber: number;
  } | null>(null);

  // Majlis One-Click Reaction Guard State
  const [reactedMajlisKeys, setReactedMajlisKeys] = useState<
    Record<string, boolean>
  >({});

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
    if (!showProfileDropdown) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(e.target as Node)
      ) {
        setShowProfileDropdown(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowProfileDropdown(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showProfileDropdown]);

  useEffect(() => {
    if (previewData) {
      setSiteData(previewData);
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    fetchPublishedMicrositeBySlug(siteSlug)
      .then(async (res) => {
        if (!mounted) return;
        if (res && res.siteAccessMode === 'PRIVATE_WHITELIST') {
          const decision = evaluatePublicMicrositeAccessGate({
            isPreviewMode: Boolean(isOwnerPreview),
            siteData: res,
            viewerUid: auth.currentUser?.uid,
            viewerEmail: auth.currentUser?.email || viewerEmail || '',
            passcodeUnlocked: false,
          });
          if (decision.shouldShowRestrictedGate && decision.requiresPasscode) {
            const storedHash = readStoredPasscodeHashForSlug(siteSlug);
            if (storedHash) {
              const unlockedMirror =
                await restorePublishedMicrositeByPasscodeHash(
                  siteSlug,
                  storedHash
                );
              if (mounted && unlockedMirror) {
                setSiteData(unlockedMirror);
                setAccessCodeUnlocked(true);
                setLoading(false);
                return;
              }
              clearAllPortalSessionUnlocks(siteSlug);
            }
          }
        }
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
  }, [siteSlug, previewData, authSyncKey, isOwnerPreview, viewerEmail]);

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

  const signedInUser = auth.currentUser;
  const effectiveAuthenticatedEmail = (
    signedInUser?.email ||
    (signedInUser ? viewerEmail : '') ||
    ''
  )
    .trim()
    .toLowerCase();

  const accessGate = useMemo(
    () =>
      evaluatePublicMicrositeAccessGate({
        isPreviewMode: Boolean(previewData) || isOwnerPreview,
        siteData,
        viewerUid: signedInUser?.uid,
        viewerEmail: effectiveAuthenticatedEmail,
        passcodeUnlocked: accessCodeUnlocked,
      }),
    [
      previewData,
      isOwnerPreview,
      siteData,
      signedInUser?.uid,
      effectiveAuthenticatedEmail,
      accessCodeUnlocked,
    ]
  );

  const enrichmentPermission = useMemo(
    () =>
      resolvePublicSiteEnrichmentPermission({
        privacyConfig: siteData?.privacyConfig,
        siteOwnerId: siteData?.ownerId,
        whitelistedEmails: siteData?.whitelistedEmails,
        whitelistedUids: siteData?.whitelistedUids,
        whitelistedMemberMeta: siteData?.whitelistedMemberMeta,
        viewerUid: signedInUser?.uid,
        viewerEmail: effectiveAuthenticatedEmail,
        isOwnerPreview: isOwnerPreview || Boolean(previewData),
        accessCodeUnlocked,
        activeInvitationStatus: activeInvitation?.status,
        activeInvitationEmail: activeInvitation?.invitedEmail,
        justClaimedEmail: justClaimedRelative?.email,
      }),
    [
      siteData,
      signedInUser?.uid,
      effectiveAuthenticatedEmail,
      authSyncKey,
      isOwnerPreview,
      previewData,
      accessCodeUnlocked,
      activeInvitation,
      justClaimedRelative,
    ]
  );

  const isAuthorizedFamilyCircle =
    accessGate.isOwner ||
    accessGate.isAuthorizedMember ||
    enrichmentPermission.isCircleMember ||
    accessCodeUnlocked;

  const portalViewerDisplayName = useMemo(() => {
    const candidate = (
      viewerName ||
      signedInUser?.displayName ||
      effectiveAuthenticatedEmail.split('@')[0] ||
      'عضو جذوري'
    ).trim();
    return candidate || 'عضو جذوري';
  }, [viewerName, signedInUser?.displayName, effectiveAuthenticatedEmail]);

  const portalViewerRoleBadge = useMemo(() => {
    if (accessGate.isOwner) return 'أمين السجل';
    if (enrichmentPermission.viewerCircleRole === 'assistant_registrar')
      return 'مساعد أمين السجل';
    if (enrichmentPermission.viewerCircleRole === 'memory_contributor')
      return 'راوي الذاكرة';
    if (accessGate.isAuthorizedMember) return 'عضو الدائرة';
    return 'عضو جذوري';
  }, [
    accessGate.isOwner,
    accessGate.isAuthorizedMember,
    enrichmentPermission.viewerCircleRole,
  ]);

  const canRenderVisibility = (vis?: ModuleVisibility): boolean => {
    const effective = vis || 'PUBLIC';
    if (effective === 'HIDDEN') return false;
    if (effective === 'FAMILY_ONLY') return isAuthorizedFamilyCircle;
    return true;
  };

  const handleVerifyFamilyAccessCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteData) return;
    const candidate = accessCodeInput.trim();
    if (!candidate) {
      setAccessCodeFeedback('يرجى إدخال رمز الدخول السري للعائلة أولاً.');
      return;
    }

    // Preview / local fallback when siteData already carries the code
    const localExpected = (siteData.privacyConfig?.familyAccessCode || '').trim();
    if (localExpected) {
      if (candidate.toLowerCase() === localExpected.toLowerCase()) {
        setAccessCodeUnlocked(true);
        setAccessCodeFeedback(null);
        setAccessCodeInput('');
      } else {
        setAccessCodeFeedback(
          'رمز الدخول السري غير صحيح. يرجى التأكد منه لدى أمين سجل العائلة.'
        );
      }
      return;
    }

    setAccessCodeBusy(true);
    setAccessCodeFeedback(null);
    try {
      const outcome = await unlockPublishedMicrositeByPasscode(
        siteData.siteSlug,
        candidate
      );
      if (outcome.ok && outcome.siteData && outcome.passcodeHash) {
        saveStoredPasscodeHashForSlug(siteData.siteSlug, outcome.passcodeHash);
        setSiteData(outcome.siteData);
        setAccessCodeUnlocked(true);
        setAccessCodeInput('');
        setAccessCodeFeedback(null);
      } else {
        setAccessCodeFeedback(
          outcome.errorAr ||
            'رمز الدخول السري غير صحيح. يرجى التأكد منه لدى أمين سجل العائلة.'
        );
      }
    } finally {
      setAccessCodeBusy(false);
    }
  };

  const handleLockPasscodeSession = async () => {
    clearAllPortalSessionUnlocks(siteData?.siteSlug || siteSlug);
    setAccessCodeUnlocked(false);
    setAccessCodeInput('');
    setAccessCodeFeedback(null);
    if (!previewData && siteData) {
      setSiteData((prev) =>
        prev
          ? {
              ...prev,
              bioTitle: undefined,
              bioDescription: undefined,
              publishedTreeMembers: [],
              publishedVaultItems: [],
              cmsModules: undefined,
              whitelistedEmails: [],
              whitelistedUids: [],
              ownerEmail: undefined,
            }
          : null
      );
      const lockedStub = await fetchPublishedMicrositeBySlug(siteSlug);
      if (lockedStub) setSiteData(lockedStub);
    }
  };

  const handlePortalLogout = async () => {
    setShowProfileDropdown(false);
    clearAllPortalSessionUnlocks();
    setAccessCodeUnlocked(false);
    setAccessCodeInput('');
    setAccessCodeFeedback(null);
    setActiveCircleEmail('');
    setCircleEmailInput('');
    setCircleVerifyFeedback(null);
    setJustClaimedRelative(null);

    // Synchronously strip private payload on restricted sites for zero-flash instant lock
    if (accessGate.isRestrictedSite && !previewData) {
      setSiteData((prev) =>
        prev
          ? {
              ...prev,
              bioTitle: undefined,
              bioDescription: undefined,
              publishedTreeMembers: [],
              publishedVaultItems: [],
              cmsModules: undefined,
              whitelistedEmails: [],
              whitelistedUids: [],
              ownerEmail: undefined,
              privacyConfig: {
                showBio: false,
                showFamilyTree: false,
                hideLivingNamesForGuests: true,
                selectedVaultItemIds: [],
              },
            }
          : null
      );
    }

    await Promise.allSettled([signOut(auth), signOut(mirrorAuth)]);
    setAuthSyncKey('guest');
    onPortalSignOut?.();

    if (!previewData) {
      const refreshed = await fetchPublishedMicrositeBySlug(siteSlug);
      setSiteData(refreshed);
    }
  };

  const handlePortalLoginModalSuccess = async (
    payload: PortalLoginSuccessPayload
  ) => {
    setShowPortalLoginModal(false);
    onPortalLoginSuccess?.(payload);
    setAuthSyncKey(auth.currentUser?.uid || payload.uid || 'signed_in');
    if (payload.email) {
      setActiveCircleEmail(payload.email.trim().toLowerCase());
    }
    if (!previewData) {
      const refreshed = await fetchPublishedMicrositeBySlug(siteSlug);
      if (refreshed) {
        setSiteData(refreshed);
      }
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
    if (!siteData || !enrRequesterName.trim() || !enrMediaTitle.trim()) return;
    setEnrSubmitting(true);
    try {
      await submitTreeEnrichmentRequest({
        siteSlug: siteData.siteSlug,
        ownerId: siteData.ownerId,
        familyName: siteData.familyName,
        requesterName: enrRequesterName.trim(),
        requesterEmail:
          enrRequesterEmail ||
          activeCircleEmail ||
          auth.currentUser?.email ||
          undefined,
        requesterRoleLabel: enrichmentPermission.viewerRoleLabel,
        kinshipRelation: enrKinship.trim() || undefined,
        requestType: 'VAULT_MEDIA',
        proposalMode: 'VAULT_GIFT',
        proposedNotes: enrNotes.trim() || undefined,
        mediaTitle: enrMediaTitle.trim(),
        mediaDateOrOccasion: enrMediaOccasion.trim() || undefined,
        mediaDataOrUrl: enrMediaDataUrl || undefined,
        mediaType: 'photo',
      });
      setEnrSuccessMessage(
        'تم إرسال إهداء الصورة/الوثيقة إلى صندوق أمين سجل العائلة بنجاح! ستظهر في معرض الخزانة فور اعتمادها ✦'
      );
      setEnrNotes('');
      setEnrMediaTitle('');
      setEnrMediaOccasion('');
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
      setAudioCurrentTime(0);
      setAudioDuration(0);
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

  // Royal Restricted Portal Gate for unauthorized visitors
  if (accessGate.shouldShowRestrictedGate) {
    return (
      <div
        dir="rtl"
        data-family-site-theme={activeTheme}
        data-family-site-typography={branding.typographyId}
        data-testid="royal-restricted-portal-gate"
        className="min-h-screen fs-canvas flex flex-col justify-between"
      >
        <header className="border-b fs-border fs-surface px-4 sm:px-8 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <Lock className="w-4 h-4 fs-accent-text shrink-0" />
            <span>بوابة عائلية محمية · دائرة العائلة المعتمدة</span>
          </div>
          <div className="flex items-center gap-2">
            {signedInUser ? (
              <button
                type="button"
                onClick={handlePortalLogout}
                className="h-8 px-3 rounded-lg border fs-border text-xs font-bold text-red-700 hover:bg-red-50 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowPortalLoginModal(true)}
                className="h-8 px-3 rounded-lg fs-accent-bg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>تسجيل الدخول</span>
              </button>
            )}
            <button
              type="button"
              onClick={onExitToMainApp}
              className="text-xs font-semibold fs-accent-text hover:underline inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <span>منصة جذوري</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        <main className="max-w-xl mx-auto w-full px-4 py-10 sm:py-14 space-y-6">
          <div
            className="rounded-3xl fs-surface border p-6 sm:p-8 space-y-5 shadow-[0_24px_60px_-28px_rgba(44,30,20,0.3)]"
            style={{
              borderColor: 'color-mix(in srgb, var(--fs-gold) 45%, transparent)',
            }}
          >
            <div className="flex flex-col items-center text-center space-y-3">
              <FamilyCrestEmblem
                familyName={siteData.familyName}
                crestMode={branding.crestMode}
                crestStyle={branding.crestStyle}
                customCrestUrl={branding.customCrestUrl}
                size="md"
              />
              <div className="inline-flex items-center gap-1.5 text-xs font-bold fs-accent-text">
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {siteData.familyEmblemTag || `ديوان عائلة ${siteData.familyName}`}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold fs-display-font">
                بوابة عائلة {siteData.familyName} المحمية
              </h1>
              <p className="text-xs sm:text-sm fs-muted leading-relaxed">
                خصّص أمين سجل العائلة هذا الديوان لأفراد دائرة العائلة والمدعوين
                فقط حفاظاً على خصوصية الشجرة والذكريات العائلية.
              </p>
            </div>

            {signedInUser && !accessGate.isAuthorizedMember && (
              <div className="rounded-2xl bg-amber-50 border border-amber-300 px-4 py-3 text-xs text-amber-950 leading-relaxed">
                أنت مسجّل الدخول حالياً بالبريد{' '}
                <span dir="ltr" className="font-mono font-bold">
                  {signedInUser.email}
                </span>
                ، وهذا الحساب غير مدرج بعد في دائرة عائلة {siteData.familyName}.
                يمكنك إدخال رمز الدخول السري للعائلة أدناه أو إرسال طلب انضمام.
              </div>
            )}

            {/* 1. Family Secret Passcode Unlock */}
            {accessGate.requiresPasscode && (
              <form
                onSubmit={handleVerifyFamilyAccessCode}
                data-testid="portal-passcode-form"
                className="rounded-2xl fs-muted-surface border fs-border p-4 space-y-3"
              >
                <div className="flex items-center gap-2 text-xs font-bold">
                  <KeyRound className="w-4 h-4 fs-accent-text shrink-0" />
                  <span>لديك رمز الدخول السري للعائلة؟ أدخله لفتح الديوان:</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    dir="ltr"
                    required
                    value={accessCodeInput}
                    onChange={(e) => setAccessCodeInput(e.target.value)}
                    placeholder="أدخل رمز العائلة السري..."
                    aria-label="رمز الدخول السري للعائلة"
                    data-testid="portal-passcode-input"
                    className="flex-1 h-10 px-3.5 rounded-xl bg-white text-[#252321] border fs-border text-xs font-mono font-bold focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={accessCodeBusy}
                    data-testid="portal-passcode-submit"
                    className="h-10 px-5 rounded-xl fs-accent-bg text-xs font-bold cursor-pointer shrink-0 disabled:opacity-60 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    {accessCodeBusy ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>جاري التحقق...</span>
                      </>
                    ) : (
                      <span>فتح ديوان العائلة</span>
                    )}
                  </button>
                </div>
                {accessCodeFeedback && (
                  <p className="text-xs text-red-700 font-semibold">
                    {accessCodeFeedback}
                  </p>
                )}
              </form>
            )}

            {/* 2. Verified Account Sign-In CTA */}
            {!signedInUser && (
              <div className="rounded-2xl fs-muted-surface border fs-border p-4 space-y-3">
                <div className="text-xs font-bold">
                  هل أنت أمين السجل أو أحد أفراد دائرة العائلة المعتمدين؟
                </div>
                <p className="text-[11px] fs-muted leading-relaxed">
                  سجّل دخولك بحسابك الموثّق في جذوري ليتم فتح ديوان العائلة
                  والشجرة المشتركة لك تلقائياً بصلاحياتك الكاملة.
                </p>
                <button
                  type="button"
                  onClick={() => setShowPortalLoginModal(true)}
                  data-testid="portal-gate-login-btn"
                  className="w-full h-10 px-4 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>تسجيل الدخول لحسابك في جذوري</span>
                </button>
              </div>
            )}

            {/* 3. Polite Access Request Form */}
            <div className="border-t fs-border pt-4">
              {accessReqSent ? (
                <div className="rounded-2xl fs-muted-surface border fs-border p-4 text-center space-y-1.5">
                  <CheckCircle2 className="w-6 h-6 fs-accent-text mx-auto" />
                  <div className="text-sm font-bold fs-display-font">
                    تم رفع طلب الانضمام إلى أمين سجل عائلة {siteData.familyName}
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
                    أو أرسل طلب انضمام لدائرة العائلة إلى أمين السجل:
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
                      ? 'جاري إرسال طلب الانضمام...'
                      : 'طلب انضمام لدائرة العائلة'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </main>

        <footer className="py-5 text-center text-xs fs-muted border-t fs-border">
          موثق رقمياً عبر منصة جذوري للأنساب والإرث العائلي العربي · Juthori.com
        </footer>

        {showPortalLoginModal && (
          <LoginModal
            isOpen={showPortalLoginModal}
            onClose={() => setShowPortalLoginModal(false)}
            onLoginSuccess={handlePortalLoginModalSuccess}
          />
        )}

        {showInviteClaimModal && activeInvitation && (
          <KinshipInviteClaimModal
            isOpen={showInviteClaimModal}
            invitation={activeInvitation}
            onClose={() => setShowInviteClaimModal(false)}
            onClaimCompleted={handleInviteClaimSuccess}
          />
        )}
      </div>
    );
  }

  // ===========================================================================
  // ZERO EMPTY / DEAD SECTIONS EVALUATOR (STRICT PUBLIC VISIBILITY)
  // ===========================================================================
  const treeMembers = siteData.publishedTreeMembers || [];
  const vaultItems = siteData.publishedVaultItems || [];
  const guardians = siteData.guardiansOfMemory || [];
  const canProposeEnrichment = enrichmentPermission.canProposeEnrichment;

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

  const handleMajlisReaction = async (
    topicId: string,
    reactionKey: MajlisReactionKey
  ) => {
    const guardKey = `${topicId}:${reactionKey}`;
    if (reactedMajlisKeys[guardKey]) return;
    setReactedMajlisKeys((prev) => ({ ...prev, [guardKey]: true }));

    setSiteData((prev) => {
      if (!prev?.cmsModules) return prev;
      return {
        ...prev,
        cmsModules: {
          ...prev.cmsModules,
          majlisAndGuardiansModule: {
            ...prev.cmsModules.majlisAndGuardiansModule,
            topics: prev.cmsModules.majlisAndGuardiansModule.topics.map((t) => {
              if (t.id !== topicId) return t;
              const current = t.reactions || {
                greatIdea: 0,
                withYou: 0,
                blessGathering: 0,
              };
              return {
                ...t,
                reactions: {
                  ...current,
                  [reactionKey]: (current[reactionKey] || 0) + 1,
                },
              };
            }),
          },
        },
      };
    });

    if (!previewData && siteData) {
      const updated = await incrementMajlisTopicReaction({
        siteSlug: siteData.siteSlug,
        topicId,
        reactionKey,
      });
      if (updated) setSiteData(updated);
    }
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
  // EDITORIAL SCROLLYTELLING CHAPTER RENDERERS (3 ALTERNATING VISUAL RHYTHMS)
  // ===========================================================================
  const wrapInStandardContainer = (
    node: React.ReactNode,
    blockKey: string,
    hasMarker = true
  ) => (
    <ScrollRevealChapter
      key={blockKey}
      immediate={compactPreview}
      className={
        compactPreview
          ? 'px-4'
          : 'relative max-w-6xl mx-auto w-full px-4 sm:px-6'
      }
    >
      {/* Subtle Illuminated Lineage Thread Chapter Node (xl desktop) */}
      {!compactPreview && hasMarker && (
        <span
          aria-hidden="true"
          className="hidden xl:flex pointer-events-none absolute -right-5 top-10 w-3 h-3 rounded-full items-center justify-center"
          style={{
            backgroundColor: 'var(--fs-canvas)',
            border: '1.5px solid var(--fs-gold)',
            boxShadow: '0 0 10px color-mix(in srgb, var(--fs-gold) 45%, transparent)',
          }}
        >
          <span
            className="w-1 h-1 rounded-full"
            style={{ backgroundColor: 'var(--fs-gold)' }}
          />
        </span>
      )}
      {node}
    </ScrollRevealChapter>
  );

  // 1. SIGNED ROYAL EPISTLE SCROLL (PATRIARCH WELCOME QUOTE)
  const renderPatriarchQuoteBlock = (isPaired: boolean) => (
    <div
      id={isPaired ? 'portal-sec-patriarch_quote' : undefined}
      className={`relative scroll-mt-24 rounded-3xl border overflow-hidden fs-epistle-ruled ${
        isPaired
          ? 'p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-[0_16px_42px_-20px_rgba(38,24,12,0.18)] h-full'
          : 'max-w-4xl mx-auto p-7 sm:p-10 lg:p-12 space-y-7 shadow-[0_18px_48px_-22px_rgba(38,24,12,0.18)]'
      }`}
      style={{
        borderColor: 'color-mix(in srgb, var(--fs-gold) 52%, transparent)',
        backgroundColor: 'var(--fs-surface)',
      }}
    >
      {/* Delicate Double Manuscript Inner Frame */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-2.5 rounded-[18px] border opacity-30"
        style={{ borderColor: 'var(--fs-gold)' }}
      />
      {/* Top Gilded Hairline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 top-0 h-[2px]"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--fs-gold), transparent)',
        }}
      />

      {/* Large Calligrapher's Quill & Inkwell Watermark */}
      <HeritageAmbientWatermark
        variant="quill_inkwell"
        position="left"
        opacityClass="opacity-[0.095]"
      />

      <div
        className={`relative z-10 ${
          isPaired
            ? 'space-y-4 text-right'
            : 'flex flex-col items-center text-center space-y-5'
        }`}
      >
        <div className="inline-flex items-center gap-2 text-[11px] font-bold tracking-wide fs-accent-text">
          <Scroll className="w-3.5 h-3.5 fs-gold-text" />
          <span>رسالة موقّعة من عميد ومؤسس الديوان العائلي</span>
        </div>

        <blockquote
          className={`relative ${
            isPaired
              ? 'text-lg sm:text-xl lg:text-[22px] leading-[1.9]'
              : 'text-xl sm:text-2xl lg:text-[28px] leading-[1.95] max-w-3xl px-2 sm:px-6'
          } fs-display-font font-bold text-balance`}
        >
          <span
            aria-hidden="true"
            className="fs-gold-text text-4xl sm:text-5xl leading-none align-middle ml-2 opacity-85"
          >
            «
          </span>
          {branding.patriarchQuote.text.trim()}
          <span
            aria-hidden="true"
            className="fs-gold-text text-4xl sm:text-5xl leading-none align-middle mr-2 opacity-85"
          >
            »
          </span>
        </blockquote>
      </div>

      {/* Signed Parchment Plinth + Embossed Golden Wax Seal */}
      <div
        className={`relative z-10 flex flex-wrap items-center gap-4 pt-5 border-t border-dashed ${
          isPaired ? 'justify-between' : 'justify-center sm:justify-between max-w-2xl mx-auto w-full'
        }`}
        style={{
          borderColor: 'color-mix(in srgb, var(--fs-gold) 45%, transparent)',
        }}
      >
        <div className="flex items-center gap-3.5">
          <FamilyCrestEmblem
            familyName={siteData.familyName}
            crestMode={branding.crestMode}
            crestStyle={branding.crestStyle}
            customCrestUrl={branding.customCrestUrl}
            size="xs"
          />
          <div className="text-right">
            <div className="text-[10.5px] font-bold fs-muted">
              توقيع عميد الأسرة
            </div>
            <div className="text-base sm:text-lg font-bold fs-accent-text fs-display-font">
              {branding.patriarchQuote.authorName}
            </div>
            {branding.patriarchQuote.authorTitle && (
              <div className="text-xs fs-muted">
                {branding.patriarchQuote.authorTitle}
              </div>
            )}
          </div>
        </div>

        {/* Embossed Golden Wax Seal Medallion */}
        <div
          aria-hidden="true"
          className="relative w-16 h-16 rounded-full flex items-center justify-center shrink-0 shadow-[0_8px_20px_-6px_rgba(146,98,28,0.55)]"
          style={{
            background:
              'radial-gradient(circle at 32% 28%, #F8E2A8 0%, #CFA14A 52%, #8C611A 100%)',
          }}
        >
          <div
            className="w-[54px] h-[54px] rounded-full border border-dashed flex flex-col items-center justify-center text-center leading-tight"
            style={{
              borderColor: 'rgba(255, 249, 232, 0.72)',
              color: '#3B250A',
            }}
          >
            <span className="text-[9px] font-bold tracking-tight">ختم</span>
            <span className="text-[10px] font-extrabold fs-display-font">
              الديوان
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // 1B. CARTOGRAPHIC TOPOGRAPHIC ATLAS (CONNECTED ROUTE NODES + COMPASS ROSE)
  const renderAtlasCards = (inBentoPair: boolean) => {
    const locations = cms.atlasAndStatsModule.locations;
    const maxLoc = Math.max(
      1,
      ...locations.map((l) => l.householdsOrMembersCount || 1)
    );
    const totalLoc = Math.max(
      1,
      locations.reduce((s, l) => s + (l.householdsOrMembersCount || 1), 0)
    );

    return (
      <div
        className="relative overflow-hidden rounded-3xl fs-surface border p-5 sm:p-7 shadow-[0_14px_38px_-18px_rgba(32,22,14,0.16)]"
        style={{
          borderColor: 'color-mix(in srgb, var(--fs-gold) 44%, transparent)',
          background:
            'linear-gradient(155deg, var(--fs-surface) 0%, var(--fs-surface-alt) 100%)',
        }}
      >
        {/* Topographic Contour Lines & Cartographic Compass Rose Watermark */}
        <HeritageAmbientWatermark
          variant="topographic_map"
          opacityClass="opacity-[0.12]"
        />

        {/* Cartographic Legend Header */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-dashed fs-border">
          <div className="inline-flex items-center gap-2 text-xs font-bold fs-accent-text">
            <Compass className="w-4 h-4 fs-gold-text" />
            <span>خريطة ومسارات انتشار حواضر العائلة</span>
          </div>
          <div className="text-[11px] font-bold fs-muted tabular-nums">
            {locations.length} {locations.length === 1 ? 'حاضرة موثّقة' : 'حواضر وديار موثّقة'}
          </div>
        </div>

        {/* Connected Vertical Dotted Gilded Route Path */}
        <div className="relative z-10 pr-2 sm:pr-4">
          {locations.length > 1 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-[23px] sm:right-[31px] top-6 bottom-6 border-r-2 border-dashed opacity-60"
              style={{ borderColor: 'var(--fs-gold)' }}
            />
          )}

          <div
            className={
              inBentoPair || locations.length <= 3
                ? 'space-y-4'
                : 'grid grid-cols-1 md:grid-cols-2 gap-4'
            }
          >
            {locations.map((loc, idx) => {
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
                  className="relative flex items-start gap-3.5 sm:gap-4 group"
                >
                  {/* Glowing Gilded Map Pin Node on Route Path */}
                  <div className="relative z-10 mt-3 shrink-0">
                    <div
                      className="w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-110"
                      style={{
                        backgroundColor: 'var(--fs-surface)',
                        borderColor: 'var(--fs-gold)',
                        boxShadow:
                          '0 0 0 4px color-mix(in srgb, var(--fs-gold) 18%, transparent)',
                        color: 'var(--fs-accent)',
                      }}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Route Station Card */}
                  <div
                    className="flex-1 rounded-2xl fs-surface/95 backdrop-blur-xs border p-4 sm:p-5 space-y-3 shadow-xs hover:shadow-md transition-all"
                    style={{
                      borderColor:
                        'color-mix(in srgb, var(--fs-gold) 34%, transparent)',
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10.5px] font-mono font-bold fs-gold-text tabular-nums">
                            0{idx + 1}
                          </span>
                          <h3 className="text-sm sm:text-base font-bold fs-display-font truncate">
                            {primaryLabel}
                          </h3>
                        </div>
                        {secondaryLabel && (
                          <div className="text-xs fs-muted mt-0.5 flex items-center gap-1">
                            <Landmark className="w-3 h-3 fs-gold-text shrink-0" />
                            <span>{secondaryLabel}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-left shrink-0">
                        <div className="text-sm font-bold fs-accent-text tabular-nums">
                          {countVal} عائلة/فرد
                        </div>
                        <div className="text-[11px] font-semibold fs-muted tabular-nums">
                          {sharePct}% من التركز
                        </div>
                      </div>
                    </div>

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
        </div>
      </div>
    );
  };

  // Sculpted Arch-Topped Pedestal Cards for Notables (breaks rectangular monotony)
  const renderNotablesCards = (inBentoPair: boolean) => {
    const items = cms.notablesModule.items;
    return (
      <div
        className={
          inBentoPair
            ? items.length === 1
              ? 'grid grid-cols-1 gap-5'
              : 'grid grid-cols-1 sm:grid-cols-2 gap-4'
            : getAdaptiveGridClass(items.length, compactPreview, 3)
        }
      >
        {items.map((n) => (
          <article
            key={n.id}
            className="group relative rounded-t-[110px] rounded-b-2xl fs-surface border pt-7 pb-6 px-5 sm:px-6 text-center shadow-[0_12px_34px_-18px_rgba(32,22,14,0.18)] hover:-translate-y-1 transition-all duration-300 flex flex-col items-center justify-between gap-4"
            style={{
              borderColor:
                'color-mix(in srgb, var(--fs-gold) 44%, transparent)',
            }}
          >
            {/* Delicate Inner Arch Crest Line */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-2.5 rounded-t-[100px] rounded-b-xl border opacity-25"
              style={{ borderColor: 'var(--fs-gold)' }}
            />

            <div className="relative z-10 flex flex-col items-center space-y-3 w-full">
              {/* Double Gold-Ringed Circular Medallion Portrait */}
              <div
                className="w-20 h-20 rounded-full p-[3px] shadow-md transition-transform duration-300 group-hover:scale-105"
                style={{
                  background:
                    'linear-gradient(135deg, #F3D999 0%, var(--fs-gold) 55%, var(--fs-accent) 100%)',
                }}
              >
                <div
                  className="w-full h-full rounded-full overflow-hidden border-2 flex items-center justify-center"
                  style={{
                    borderColor: 'var(--fs-surface)',
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
                    <span className="text-xl font-bold fs-display-font">
                      {getArabicMonogram(n.fullName)}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-bold fs-accent-text tracking-wide">
                  ✦ {n.roleOrTitle}
                </div>
                <h3 className="text-base sm:text-lg font-bold fs-display-font leading-snug">
                  {n.fullName}
                </h3>
                {n.eraLabel && (
                  <div className="text-[11px] fs-muted tabular-nums">
                    {n.eraLabel}
                  </div>
                )}
              </div>
            </div>

            <p className="relative z-10 text-xs sm:text-sm fs-muted leading-relaxed pt-3 border-t fs-border w-full">
              {n.achievementSummary}
            </p>
          </article>
        ))}
      </div>
    );
  };

  // 6A. EXECUTIVE GUILD MEDALLION CARDS FOR PROFESSIONS (ZERO EMPTY LEFT STRIP)
  const renderProfessionsCards = (inBentoPair: boolean) => {
    const items = cms.professionsModule.items;
    return (
      <div
        className={
          inBentoPair
            ? items.length === 1
              ? 'grid grid-cols-1 gap-4'
              : 'grid grid-cols-1 sm:grid-cols-2 gap-4'
            : getAdaptiveGridClass(items.length, compactPreview, 3)
        }
      >
        {items.map((prof) => {
          const monogram = getArabicMonogram(prof.memberName);
          const cleanCity = cleanLocationField(prof.cityCountryLabel);
          return (
            <article
              key={prof.id}
              className="group relative overflow-hidden rounded-3xl fs-surface border pt-7 pb-6 px-6 text-center shadow-[0_14px_34px_-18px_rgba(32,22,14,0.18)] hover:-translate-y-1 transition-all duration-300 flex flex-col items-center justify-between gap-4"
              style={{
                borderColor:
                  'color-mix(in srgb, var(--fs-gold) 44%, transparent)',
                background:
                  'linear-gradient(175deg, var(--fs-surface) 0%, var(--fs-surface-alt) 100%)',
              }}
            >
              {/* Top Gilded Guild Ribbon */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-1.5 fs-accent-gold-bar opacity-85"
              />

              {/* Auto-Detected Specialty SVG Watermark (Medical / Engineering / Law / Education / Guild) */}
              <GuildSpecialtyWatermark
                fieldCategory={prof.fieldCategory}
                specialty={prof.specialtyOrProfession}
              />

              <div className="relative z-10 flex flex-col items-center space-y-3 w-full">
                {/* Double Gold-Ringed Circular Executive Monogram Medallion */}
                <div
                  className="w-16 h-16 rounded-full p-[3px] shadow-md transition-transform duration-300 group-hover:scale-105"
                  style={{
                    background:
                      'linear-gradient(135deg, #F4DA9B 0%, var(--fs-gold) 55%, var(--fs-accent) 100%)',
                  }}
                >
                  <div
                    className="w-full h-full rounded-full border-2 flex items-center justify-center font-bold fs-display-font text-xl"
                    style={{
                      borderColor: 'var(--fs-surface)',
                      background:
                        'linear-gradient(145deg, var(--fs-hero-bg) 0%, var(--fs-hero-bg-deep, var(--fs-hero-bg)) 100%)',
                      color: 'var(--fs-gold)',
                    }}
                  >
                    {monogram}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-bold tracking-wide fs-accent-text">
                    ✦ {prof.fieldCategory}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold fs-display-font leading-snug">
                    {prof.memberName}
                  </h3>
                  <p className="text-xs sm:text-sm fs-muted leading-relaxed">
                    {prof.specialtyOrProfession}
                  </p>
                </div>
              </div>

              {/* Clean Footer Guild Plinth */}
              <div className="relative z-10 w-full pt-3 border-t border-dashed fs-border flex items-center justify-center gap-2 text-xs fs-muted">
                {cleanCity ? (
                  <>
                    <MapPin className="w-3.5 h-3.5 fs-gold-text shrink-0" />
                    <span className="font-semibold">{cleanCity}</span>
                  </>
                ) : (
                  <>
                    <Briefcase className="w-3.5 h-3.5 fs-gold-text shrink-0" />
                    <span className="font-semibold">كفاءة عائلية موثّقة</span>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  const renderNewsCards = (inBentoPair: boolean) => {
    const isSingleNews =
      cms.newsModule.items.length === 1 && !compactPreview && !inBentoPair;
    return (
      <div
        className={
          inBentoPair
            ? 'grid grid-cols-1 gap-4'
            : getAdaptiveGridClass(cms.newsModule.items.length, compactPreview, 2)
        }
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
                  <span className="font-bold fs-accent-text">
                    ✦ {item.category}
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
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] fs-muted">
                    {item.blessings.slice(-5).map((b) => (
                      <span key={b.id}>✦ {b.senderName}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  };

  // 6B. ROYAL PERFORATED INVITATION TICKET FOR UPCOMING EVENTS
  const renderEventsCards = (inBentoPair: boolean) => {
    const items = cms.eventsModule.items;
    return (
      <div
        className={
          inBentoPair || items.length === 1
            ? 'grid grid-cols-1 gap-5'
            : 'grid grid-cols-1 gap-5'
        }
      >
        {items.map((ev) => {
          const cd = formatCountdownParts(ev.eventDateIso);
          const calLeaf = parseArabicCalendarLeaf(ev.eventDateIso);
          const attendingTotal = (ev.rsvps || [])
            .filter((r) => r.status === 'attending')
            .reduce((sum, r) => sum + 1 + (r.companionsCount || 0), 0);
          const isCopied = copiedEventId === ev.id;
          const cleanVenue = cleanLocationField(ev.locationLabel);

          return (
            <article
              key={ev.id}
              className="relative rounded-3xl fs-surface border shadow-[0_16px_42px_-20px_rgba(32,22,14,0.2)] overflow-hidden"
              style={{
                borderColor:
                  'color-mix(in srgb, var(--fs-gold) 48%, transparent)',
                background:
                  'linear-gradient(135deg, var(--fs-surface) 0%, var(--fs-surface-alt) 100%)',
              }}
            >
              {/* Top Gilded Invitation Ribbon */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-1.5 fs-accent-gold-bar opacity-90"
              />

              {/* Perforated Semicircular Ticket Notches (Left & Right Edges) */}
              <span
                aria-hidden="true"
                className="pointer-events-none hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border z-20"
                style={{
                  backgroundColor: 'var(--fs-canvas)',
                  borderColor:
                    'color-mix(in srgb, var(--fs-gold) 48%, transparent)',
                }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none hidden md:block absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border z-20"
                style={{
                  backgroundColor: 'var(--fs-canvas)',
                  borderColor:
                    'color-mix(in srgb, var(--fs-gold) 48%, transparent)',
                }}
              />

              <div
                className={`relative z-10 grid ${
                  compactPreview || inBentoPair
                    ? 'grid-cols-1'
                    : 'grid-cols-1 md:grid-cols-12'
                }`}
              >
                {/* RIGHT MAIN TICKET BODY: Split Tear-Off Calendar Leaf + Invitation Details */}
                <div
                  className={`${
                    compactPreview || inBentoPair
                      ? 'p-5'
                      : 'md:col-span-8 p-6 sm:p-7'
                  } flex flex-col sm:flex-row items-start gap-5`}
                >
                  {/* Split Tear-Off Calendar Leaf */}
                  <div
                    className="w-24 sm:w-28 rounded-2xl overflow-hidden border shadow-sm shrink-0 text-center"
                    style={{
                      borderColor:
                        'color-mix(in srgb, var(--fs-gold) 55%, transparent)',
                      backgroundColor: 'var(--fs-surface)',
                    }}
                  >
                    <div
                      className="py-1.5 px-2 text-[10.5px] font-bold tracking-wide text-[#FFF8EA]"
                      style={{
                        background:
                          'linear-gradient(135deg, var(--fs-accent) 0%, var(--fs-hero-bg) 100%)',
                      }}
                    >
                      {calLeaf.month}
                    </div>
                    <div className="py-2.5 px-2">
                      <div className="text-3xl sm:text-4xl font-extrabold fs-display-font fs-accent-text tabular-nums leading-none">
                        {calLeaf.day}
                      </div>
                      {calLeaf.year && (
                        <div className="text-[10.5px] font-bold fs-muted mt-1 tabular-nums">
                          {calLeaf.year}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Invitation Typography & Venue */}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-bold fs-accent-text">
                      <Sparkles className="w-3.5 h-3.5 fs-gold-text" />
                      <span>
                        بطاقة دعوة عائلية رسمية
                        {calLeaf.weekday ? ` · يوم ${calLeaf.weekday}` : ''}
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold fs-display-font leading-snug break-words">
                      {ev.title}
                    </h3>
                    {cleanVenue && (
                      <div className="text-xs sm:text-sm fs-muted flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 fs-accent-text shrink-0" />
                        <span>{cleanVenue}</span>
                      </div>
                    )}
                    {ev.hostNote && (
                      <p className="text-xs sm:text-sm fs-muted leading-relaxed pt-1">
                        {ev.hostNote}
                      </p>
                    )}
                  </div>
                </div>

                {/* LEFT PERFORATED TICKET STUB: Countdown + RSVP & Copy Actions */}
                <div
                  className={`${
                    compactPreview || inBentoPair
                      ? 'border-t px-5 py-4'
                      : 'md:col-span-4 border-t md:border-t-0 md:border-r p-6 sm:p-7'
                  } border-dashed flex flex-col justify-between gap-4`}
                  style={{
                    borderColor:
                      'color-mix(in srgb, var(--fs-gold) 52%, transparent)',
                    backgroundColor: 'var(--fs-gold-soft)',
                  }}
                >
                  <div className="space-y-3">
                    {!cd.expired ? (
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { val: cd.days, lbl: 'يوم' },
                          { val: cd.hours, lbl: 'ساعة' },
                          { val: cd.minutes, lbl: 'دقيقة' },
                        ].map((unit) => (
                          <div
                            key={unit.lbl}
                            className="py-2 px-1.5 rounded-xl fs-surface border text-center"
                            style={{
                              borderColor:
                                'color-mix(in srgb, var(--fs-gold) 42%, transparent)',
                            }}
                          >
                            <div className="text-base font-bold fs-accent-text tabular-nums leading-none">
                              {unit.val}
                            </div>
                            <div className="text-[9.5px] fs-muted mt-1 font-semibold">
                              {unit.lbl}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs font-bold fs-accent-text text-center py-1.5 rounded-xl fs-surface border fs-border">
                        ✦ {cd.label}
                      </div>
                    )}

                    <div className="text-xs font-semibold fs-muted text-center tabular-nums">
                      {attendingTotal > 0
                        ? `المؤكّد حضورهم حتى الآن: ${attendingTotal}`
                        : 'الدعوة مفتوحة لأفراد العائلة الكرام'}
                    </div>
                  </div>

                  {!compactPreview && (
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setRsvpOpenEventId(
                            rsvpOpenEventId === ev.id ? null : ev.id
                          )
                        }
                        className="w-full py-2.5 px-4 rounded-xl fs-accent-bg text-xs font-bold cursor-pointer hover:opacity-95 transition-opacity shadow-xs"
                      >
                        تأكيد الحضور (RSVP)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyEventDetails(ev)}
                        className="w-full py-2 px-3 rounded-xl fs-surface border fs-border text-xs font-bold fs-accent-text inline-flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>تم نسخ بطاقة الموعد</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>نسخ بطاقة الموعد</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {rsvpOpenEventId === ev.id && (
                <div className="relative z-10 border-t fs-border fs-surface-alt px-5 sm:px-7 py-4 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <input
                      type="text"
                      value={rsvpName}
                      onChange={(e) => setRsvpName(e.target.value)}
                      placeholder="الاسم الكامل"
                      className="sm:col-span-4 px-3 py-2 rounded-xl fs-surface border fs-border text-xs"
                    />
                    <select
                      value={rsvpStatus}
                      onChange={(e) =>
                        setRsvpStatus(
                          e.target.value as 'attending' | 'apologizing'
                        )
                      }
                      className="sm:col-span-4 px-3 py-2 rounded-xl fs-surface border fs-border text-xs"
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
                      placeholder="المرافقون"
                      className="sm:col-span-2 px-3 py-2 rounded-xl fs-surface border fs-border text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleSubmitRsvp(ev.id)}
                      className="sm:col-span-2 py-2 px-3 rounded-xl fs-accent-bg text-xs font-bold cursor-pointer"
                    >
                      حفظ التأكيد
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    );
  };

  // 3. OPEN HERITAGE STORYBOOK SPREAD (CHRONICLE BOOK PAGES + FULL READER MODAL)
  const renderStoriesCards = (inBentoPair: boolean) => {
    const stories = cms.storiesModule.items;
    return (
      <div className="space-y-6">
        {stories.map((st, idx) => {
          const chapterNum = idx + 1;
          const chapterCode = String(chapterNum).padStart(2, '0');
          const formattedEra = formatArabicLongDate(st.eraOrYearLabel);
          const isTwoPageSpread = !inBentoPair && !compactPreview;

          return (
            <article
              key={st.id}
              className="relative overflow-hidden rounded-3xl fs-surface border shadow-[0_18px_46px_-22px_rgba(40,26,14,0.22)]"
              style={{
                borderColor:
                  'color-mix(in srgb, var(--fs-gold) 48%, transparent)',
                background:
                  'linear-gradient(160deg, var(--fs-surface) 0%, var(--fs-surface-alt) 100%)',
              }}
            >
              {/* Delicate Book Cover Hairline Frame */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-2.5 rounded-[18px] border opacity-25"
                style={{ borderColor: 'var(--fs-gold)' }}
              />

              {/* Central Book Spine Binding Shadow (Desktop Open Spread) */}
              {isTwoPageSpread && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none hidden md:block absolute inset-y-0 right-[41.666%] w-8 -translate-x-1/2 z-10"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent 0%, rgba(56,36,18,0.09) 46%, rgba(56,36,18,0.14) 50%, rgba(56,36,18,0.06) 58%, transparent 100%)',
                  }}
                />
              )}

              <div
                className={`relative z-10 grid ${
                  isTwoPageSpread ? 'grid-cols-1 md:grid-cols-12' : 'grid-cols-1'
                }`}
              >
                {/* RIGHT PAGE: Classic Corner-Bracketed Museum Photo Plate OR Illuminated Frontispiece */}
                <div
                  className={`${
                    isTwoPageSpread
                      ? 'md:col-span-5 p-6 sm:p-8 flex flex-col justify-center border-b md:border-b-0 md:border-l'
                      : 'p-5 border-b'
                  } fs-border`}
                  style={{
                    background:
                      'linear-gradient(145deg, var(--fs-gold-soft) 0%, var(--fs-surface-alt) 100%)',
                  }}
                >
                  {st.imageUrl ? (
                    <div
                      className="relative rounded-2xl bg-[#FFFDF8] p-2.5 border shadow-md"
                      style={{
                        borderColor:
                          'color-mix(in srgb, var(--fs-gold) 55%, transparent)',
                      }}
                    >
                      {/* Classic Gilded Photo Corner Brackets */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1.5 right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 rounded-tr-xs"
                        style={{ borderColor: 'var(--fs-gold)' }}
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute bottom-1.5 left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 rounded-bl-xs"
                        style={{ borderColor: 'var(--fs-gold)' }}
                      />
                      <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[#E8DED2]">
                        <img
                          src={st.imageUrl}
                          alt={st.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  ) : (
                    <div
                      className="rounded-2xl border border-dashed p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[190px]"
                      style={{
                        borderColor:
                          'color-mix(in srgb, var(--fs-gold) 52%, transparent)',
                        backgroundColor: 'var(--fs-surface)',
                      }}
                    >
                      <div
                        className="w-14 h-14 rounded-full border-2 flex items-center justify-center shadow-xs"
                        style={{
                          borderColor: 'var(--fs-gold)',
                          backgroundColor: 'var(--fs-gold-soft)',
                          color: 'var(--fs-accent)',
                        }}
                      >
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold fs-accent-text tracking-wide">
                          ✦ مروية موثّقة · الفصل {chapterCode}
                        </div>
                        {formattedEra && (
                          <div className="text-xs font-bold fs-muted tabular-nums">
                            {formattedEra}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* LEFT PAGE: Illuminated Narrative Chronicle Text + Full Reading Mode Button */}
                <div
                  className={`${
                    isTwoPageSpread
                      ? 'md:col-span-7 p-6 sm:p-8 lg:p-10'
                      : 'p-5 sm:p-6'
                  } flex flex-col justify-between space-y-5 fs-epistle-ruled`}
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-dashed fs-border text-[11px] font-bold">
                      <span className="fs-accent-text">
                        ✦ مروية موثقة · الفصل {chapterCode}
                      </span>
                      {formattedEra && (
                        <span className="fs-muted tabular-nums">
                          {formattedEra}
                        </span>
                      )}
                    </div>

                    <h3
                      className={`${
                        isTwoPageSpread
                          ? 'text-xl sm:text-2xl'
                          : 'text-lg sm:text-xl'
                      } font-bold fs-display-font leading-snug`}
                    >
                      {st.title}
                    </h3>

                    <p className="text-xs sm:text-sm fs-muted leading-[2.0] whitespace-pre-line line-clamp-6">
                      <span className="fs-gold-text text-lg font-bold ml-1.5">
                        ✦
                      </span>
                      {st.body}
                    </p>
                  </div>

                  {!compactPreview && (
                    <div className="pt-3 border-t fs-border flex items-center justify-between gap-3">
                      <span className="text-[11px] fs-muted">
                        من سجل ذاكرة عائلة {siteData.familyName}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setReadingStoryModal({
                            title: st.title,
                            eraOrYearLabel: st.eraOrYearLabel,
                            body: st.body,
                            imageUrl: st.imageUrl,
                            chapterNumber: chapterNum,
                          })
                        }
                        className="px-4 py-2 rounded-xl fs-surface border text-xs font-bold fs-accent-text inline-flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity shadow-2xs"
                        style={{
                          borderColor:
                            'color-mix(in srgb, var(--fs-gold) 48%, transparent)',
                        }}
                      >
                        <BookOpen className="w-3.5 h-3.5 fs-gold-text" />
                        <span>قراءة الحكاية في وضع السرد الكامل</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  // 5. ACOUSTIC VINYL & 42-BAR EQUALIZER CONSOLE FOR ORAL HERITAGE
  const renderOralHeritageCards = (inBentoPair: boolean) => {
    const clips = cms.oralHeritageModule.items;
    return (
      <div className="space-y-5">
        {clips.map((clip) => (
          <AcousticVinylConsole
            key={clip.id}
            clip={clip}
            isPlaying={playingClipId === clip.id}
            currentTimeSec={playingClipId === clip.id ? audioCurrentTime : 0}
            durationSec={playingClipId === clip.id ? audioDuration : 0}
            inBentoPair={inBentoPair}
            compactPreview={compactPreview}
            onTogglePlay={handleTogglePlayClip}
          />
        ))}
      </div>
    );
  };

  // Standalone Section Renderer (alternates Open Editorial Canvas, Full-Bleed Velvet Band, & Framed Pavilions)
  const renderStandaloneSection = (key: PortalSectionKey): React.ReactNode => {
    switch (key) {
      // 1. PATRIARCH WELCOME QUOTE — SIGNED ROYAL EPISTLE SCROLL
      case 'patriarch_quote':
        return wrapInStandardContainer(
          <OpenEditorialCanvasSection
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
            watermarkVariant="quill_inkwell"
          >
            {renderPatriarchQuoteBlock(false)}
          </OpenEditorialCanvasSection>,
          key
        );

      // 2. CEREMONIAL FAMILY TREE GATEHOUSE — FULL-BLEED DEEP THEME VELVET BAND
      case 'tree_mirror':
        return (
          <ScrollRevealChapter
            key={key}
            immediate={compactPreview}
            className={compactPreview ? 'px-4' : 'w-full'}
          >
            <FullBleedVelvetBand
              id={`portal-sec-${key}`}
              compactPreview={compactPreview}
            >
              <div className="space-y-6">
                <HeritagePavilionHeader
                  kicker="✦ السجل الشجري الجامع"
                  title={`دوحة نسب عائلة ${siteData.familyName}`}
                  subtitle="استعرض تسلسل أجيال وفروع العائلة المسجلة في الديوان العائلي عبر بوابة المشجرة التفاعلية."
                  icon={<GitBranch className="w-3.5 h-3.5" />}
                  tone="light"
                />
                <PublicVisualTreeMirror
                  members={treeMembers}
                  familyName={siteData.familyName}
                  generationsCount={generationsCount}
                  treeDisplaySettings={siteData.treeDisplaySettings}
                  isAuthorizedFamilyViewer={isAuthorizedFamilyCircle}
                  compactPreview={compactPreview}
                  velvetBandMode={false}
                  canProposeEnrichment={canProposeEnrichment}
                  siteSlug={siteData.siteSlug}
                  ownerId={siteData.ownerId}
                  viewerDefaultName={
                    viewerName ||
                    enrichmentPermission.matchedCircleMember?.name ||
                    activeInvitation?.relativeName ||
                    ''
                  }
                  viewerDefaultEmail={
                    activeCircleEmail ||
                    viewerEmail ||
                    auth.currentUser?.email ||
                    ''
                  }
                  viewerDefaultKinship={
                    viewerKinshipRelation ||
                    enrichmentPermission.matchedCircleMember?.kinshipRelation ||
                    activeInvitation?.kinshipRelation ||
                    ''
                  }
                  viewerRoleLabel={enrichmentPermission.viewerRoleLabel}
                />
              </div>
            </FullBleedVelvetBand>
          </ScrollRevealChapter>
        );

      // 3. CURATED MUSEUM VAULT WALL — FULL-BLEED FRAMED ARTWORKS + GALLERY WATERMARK
      case 'vault_gallery':
        return wrapInStandardContainer(
          <OpenEditorialCanvasSection
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
            watermarkVariant="gallery_frames"
          >
            <HeritagePavilionHeader
              kicker="مقتنيات أرشيفية مختارة"
              title="معرض خزانة الصور والوثائق"
              icon={<Camera className="w-3.5 h-3.5" />}
              action={
                !compactPreview && canProposeEnrichment ? (
                  <button
                    type="button"
                    data-testid="open-vault-gift-modal-btn"
                    onClick={() => {
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
            <CuratedMuseumVaultWall
              items={vaultItems}
              treeMembers={treeMembers}
              familyName={siteData.familyName}
              compactPreview={compactPreview}
              enablePhotoFacePrompt={Boolean(
                siteData.privacyConfig.enablePhotoFacePrompt
              )}
              formatArabicLongDate={formatArabicLongDate}
              faceIdOpenItemId={faceIdOpenItemId}
              setFaceIdOpenItemId={setFaceIdOpenItemId}
              faceIdSenderName={faceIdSenderName}
              setFaceIdSenderName={setFaceIdSenderName}
              faceIdNote={faceIdNote}
              setFaceIdNote={setFaceIdNote}
              onSubmitFaceId={handleSubmitFaceId}
            />
          </OpenEditorialCanvasSection>,
          key
        );

      // 4. FAMILY NEWS & BLESSINGS — FRAMED PAVILION
      case 'news':
        return wrapInStandardContainer(
          <HeritageSectionPavilion
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
          >
            <HeritagePavilionHeader
              kicker="تباشير وأفراح العائلة"
              title="أخبار ومستجدات العائلة"
              icon={<Sparkles className="w-3.5 h-3.5" />}
            />
            {renderNewsCards(false)}
          </HeritageSectionPavilion>,
          key
        );

      // 5. EVENTS WITH ROYAL PERFORATED INVITATION TICKETS + FESTIVE CHANDELIER WATERMARK
      case 'events':
        return wrapInStandardContainer(
          <OpenEditorialCanvasSection
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
            watermarkVariant="festive_chandelier"
          >
            <HeritagePavilionHeader
              kicker="لقاءات وصلة رحم"
              title="المناسبات والملتقيات القادمة"
              icon={<Calendar className="w-3.5 h-3.5" />}
            />
            {renderEventsCards(false)}
          </OpenEditorialCanvasSection>,
          key
        );

      // 6. ANCESTOR STORIES — OPEN HERITAGE STORYBOOK SPREADS
      case 'stories':
        return wrapInStandardContainer(
          <OpenEditorialCanvasSection
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
            watermarkVariant="storybook_open"
          >
            <HeritagePavilionHeader
              kicker="سِير ومواقف خالدة"
              title="قصص الأجداد وذاكرة العائلة"
              icon={<BookOpen className="w-3.5 h-3.5" />}
            />
            {renderStoriesCards(false)}
          </OpenEditorialCanvasSection>,
          key
        );

      // 7. HALL OF FAME / NOTABLES — OPEN EDITORIAL CANVAS WITH ARCH-TOPPED PEDESTALS
      case 'notables':
        return wrapInStandardContainer(
          <OpenEditorialCanvasSection
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
            watermarkVariant="arabesque"
          >
            <HeritagePavilionHeader
              kicker="أعلام وإنجازات مشرّفة"
              title={`لوحة شرف عائلة ${siteData.familyName}`}
              icon={<Award className="w-3.5 h-3.5" />}
            />
            {renderNotablesCards(false)}
          </OpenEditorialCanvasSection>,
          key
        );

      // 8. ATLAS OF HOMELANDS — CARTOGRAPHIC TOPOGRAPHIC ROUTE ATLAS
      case 'atlas':
        return wrapInStandardContainer(
          <OpenEditorialCanvasSection
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
            watermarkVariant="topographic_map"
          >
            <HeritagePavilionHeader
              kicker="الانتشار الجغرافي والديار"
              title="أطلس ديار وحواضر العائلة"
              icon={<MapPin className="w-3.5 h-3.5" />}
            />
            {renderAtlasCards(false)}
          </OpenEditorialCanvasSection>,
          key
        );

      // 9. ORAL HERITAGE & AUDIO ARCHIVE — ACOUSTIC VINYL STUDIO CONSOLE
      case 'oral_heritage':
        return wrapInStandardContainer(
          <OpenEditorialCanvasSection
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
            watermarkVariant="acoustic_oud"
          >
            <HeritagePavilionHeader
              kicker="أصوات وقصائد ومرويات"
              title="الموروث الصوتي والشعري"
              icon={<Mic className="w-3.5 h-3.5" />}
            />
            {renderOralHeritageCards(false)}
          </OpenEditorialCanvasSection>,
          key
        );

      // 10. PROFESSIONS DIRECTORY — EXECUTIVE GUILD MEDALLION CARDS
      case 'professions':
        return wrapInStandardContainer(
          <OpenEditorialCanvasSection
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
            watermarkVariant="arabesque"
          >
            <HeritagePavilionHeader
              kicker="التكافل والخبرات العائلية"
              title="دليل الكفاءات والتخصصات"
              icon={<Briefcase className="w-3.5 h-3.5" />}
            />
            {renderProfessionsCards(false)}
          </OpenEditorialCanvasSection>,
          key
        );

      // 11. MEMORIAL CORNER (ILLUMINATED ANDALUSIAN MIHRAB SANCTUARY) + ROYAL SEALED TIME VAULT
      case 'memorial': {
        const elders = cms.memorialAndCapsuleModule.elders;
        const isSingleElder = elders.length === 1 && !compactPreview;
        const cap = cms.memorialAndCapsuleModule.timeCapsule;
        const hasCapsule =
          cap.enabled && Boolean(cap.sealedMessage.trim());
        const capCountdown = hasCapsule
          ? formatCountdownParts(cap.unlockDateIso)
          : null;
        const formattedUnlockDate = formatArabicLongDate(cap.unlockDateIso);

        return (
          <div key={key} className="space-y-6 sm:space-y-8">
            {elders.length > 0 &&
              wrapInStandardContainer(
                <OpenEditorialCanvasSection
                  id={`portal-sec-${key}`}
                  compactPreview={compactPreview}
                  watermarkVariant="mihrab_lantern"
                >
                  <HeritagePavilionHeader
                    kicker="برّ ووفاء للراحلين"
                    title="ركن الوفاء والدعاء لأجداد العائلة"
                    icon={<Heart className="w-3.5 h-3.5" />}
                  />
                  <div
                    className={
                      isSingleElder
                        ? 'max-w-xl mx-auto'
                        : getAdaptiveGridClass(
                            elders.length,
                            compactPreview,
                            2
                          )
                    }
                  >
                    {elders.map((el) => {
                      const hasPrayed = Boolean(prayedElderIds[el.id]);
                      return (
                        <article
                          key={el.id}
                          className="relative overflow-hidden rounded-t-[130px] rounded-b-3xl fs-surface border pt-10 pb-7 px-6 sm:px-8 text-center shadow-[0_18px_46px_-22px_rgba(32,22,14,0.22)] flex flex-col items-center justify-between gap-5"
                          style={{
                            borderColor:
                              'color-mix(in srgb, var(--fs-gold) 50%, transparent)',
                            background:
                              'linear-gradient(180deg, var(--fs-gold-soft) 0%, var(--fs-surface) 38%, var(--fs-surface) 100%)',
                          }}
                        >
                          {/* Inner Andalusian Mihrab Arch Hairline */}
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-3 rounded-t-[118px] rounded-b-2xl border opacity-30"
                            style={{ borderColor: 'var(--fs-gold)' }}
                          />

                          {/* Hanging Illuminated Lantern Watermark inside Arch */}
                          <HeritageAmbientWatermark
                            variant="mihrab_lantern"
                            position="center"
                            opacityClass="opacity-[0.065]"
                          />

                          <div className="relative z-10 flex flex-col items-center space-y-3.5 w-full">
                            {/* Subtle Hanging Lantern Apex Ornament */}
                            <div
                              aria-hidden="true"
                              className="text-xs font-bold fs-gold-text tracking-widest"
                            >
                              ✦ ❖ ✦
                            </div>

                            {/* Double-Ringed Golden Memorial Medallion */}
                            <div
                              className="w-16 h-16 rounded-full p-[3px] shadow-md"
                              style={{
                                background:
                                  'linear-gradient(135deg, #F5DC9F 0%, var(--fs-gold) 55%, var(--fs-accent) 100%)',
                              }}
                            >
                              <div
                                className="w-full h-full rounded-full border-2 flex items-center justify-center font-bold fs-display-font text-xl"
                                style={{
                                  borderColor: 'var(--fs-surface)',
                                  backgroundColor: 'var(--fs-surface)',
                                  color: 'var(--fs-accent)',
                                }}
                              >
                                {getArabicMonogram(el.fullName)}
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              {el.passingYearLabel && (
                                <div className="text-[11px] font-bold fs-gold-text tabular-nums">
                                  توفّي إلى رحمة الله · {el.passingYearLabel}
                                </div>
                              )}
                              <h3 className="text-xl sm:text-2xl font-bold fs-display-font leading-snug">
                                {el.fullName}
                              </h3>
                              <div className="text-xs sm:text-sm font-bold fs-accent-text">
                                رحمه الله وغفر له وأسكنه فسيح جناته
                              </div>
                            </div>

                            {el.biographyNote && (
                              <p className="text-xs sm:text-sm fs-muted leading-loose max-w-md pt-2 border-t border-dashed fs-border">
                                {el.biographyNote}
                              </p>
                            )}

                            {el.ongoingCharityTitle && (
                              <div
                                className="w-full rounded-2xl fs-surface-alt border px-4 py-3 text-xs flex items-center justify-center gap-2 text-center"
                                style={{
                                  borderColor:
                                    'color-mix(in srgb, var(--fs-gold) 36%, transparent)',
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
                          </div>

                          {/* Prominent Golden Halo Prayer CTA */}
                          <div className="relative z-10 w-full flex flex-col items-center gap-1.5 pt-2">
                            <button
                              type="button"
                              onClick={() => handlePrayForElder(el.id)}
                              className="w-full sm:w-auto px-6 py-3 rounded-full border text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer tabular-nums transition-all duration-300 hover:-translate-y-0.5"
                              style={
                                hasPrayed
                                  ? {
                                      background:
                                        'linear-gradient(135deg, #F5DC9F 0%, var(--fs-gold) 100%)',
                                      borderColor: 'var(--fs-gold)',
                                      color: '#2A1B0B',
                                      boxShadow:
                                        '0 0 26px rgba(212, 169, 85, 0.5)',
                                    }
                                  : {
                                      backgroundColor: 'var(--fs-surface-alt)',
                                      borderColor:
                                        'color-mix(in srgb, var(--fs-gold) 55%, transparent)',
                                      color: 'var(--fs-accent)',
                                    }
                              }
                            >
                              <Heart
                                className={`w-4 h-4 ${
                                  hasPrayed ? 'fill-current' : ''
                                }`}
                              />
                              <span>
                                اللهم ارحمه واغفر له · أمّن على الدعاء (
                                {el.prayersCount || 0})
                              </span>
                            </button>
                            {hasPrayed && (
                              <span className="text-[11px] font-bold fs-accent-text">
                                تقبّل الله دعاءكم وأثابكم خيراً ✦
                              </span>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </OpenEditorialCanvasSection>,
                `${key}-elders`
              )}

            {/* ROYAL SEALED TIME VAULT — FULL-BLEED DEEP VELVET BAND */}
            {hasCapsule && capCountdown && (
              <ScrollRevealChapter
                immediate={compactPreview}
                className={compactPreview ? 'px-4' : 'w-full'}
              >
                <FullBleedVelvetBand
                  id={elders.length === 0 ? `portal-sec-${key}` : 'portal-sec-time-capsule'}
                  compactPreview={compactPreview}
                >
                  <div
                    className={`flex ${
                      compactPreview
                        ? 'flex-col items-stretch gap-5'
                        : 'flex-col xl:flex-row xl:items-center justify-between gap-8'
                    }`}
                  >
                    <div className="flex items-start gap-4 sm:gap-5 min-w-0 flex-1">
                      {/* Wax-Seal Time Vault Medallion */}
                      <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full border-2 border-[#D8C7B2] bg-[#FAF7F2] text-[#D97757] flex flex-col items-center justify-center shrink-0 shadow-sm">
                        <Lock className="w-5 h-5" />
                        <span className="text-[9px] font-bold mt-0.5 text-[#1F1F1C]">مختوم</span>
                      </div>

                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D97757]">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>خزينة كبسولة الزمن العائلية</span>
                        </div>
                        <h3
                          className={`${
                            compactPreview ? 'text-lg' : 'text-xl sm:text-3xl'
                          } font-bold fs-display-font leading-snug break-words text-[#1F1F1C]`}
                        >
                          {cap.title}
                        </h3>
                        <div className="text-xs sm:text-sm text-[#1F1F1C]/75">
                          بقلم: {cap.authorElderName}
                        </div>
                        <div className="pt-2">
                          {capCountdown.expired ? (
                            <p className="text-sm sm:text-base leading-loose text-[#1F1F1C]/90 max-w-2xl">
                              {cap.sealedMessage}
                            </p>
                          ) : (
                            <p className="text-xs sm:text-sm text-[#1F1F1C]/80 leading-relaxed max-w-2xl">
                              الرسالة محفوظة ومختومة رقمياً حتى موعد الفتح الرسمي في{' '}
                              <strong className="text-[#D97757]">
                                {formattedUnlockDate}
                              </strong>
                              .
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Segmented Warm Countdown Units */}
                    {!capCountdown.expired && (
                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        {[
                          { val: capCountdown.days, lbl: 'يوم' },
                          { val: capCountdown.hours, lbl: 'ساعة' },
                          { val: capCountdown.minutes, lbl: 'دقيقة' },
                        ].map((unit) => (
                          <div
                            key={unit.lbl}
                            className="px-4 py-3 rounded-2xl bg-[#FAF7F2] border border-[#D8C7B2] text-center min-w-[74px] shadow-2xs"
                          >
                            <div className="text-xl sm:text-2xl font-bold text-[#D97757] tabular-nums leading-none">
                              {unit.val}
                            </div>
                            <div className="text-[10.5px] text-[#1F1F1C]/75 mt-1.5 font-semibold">
                              {unit.lbl}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </FullBleedVelvetBand>
              </ScrollRevealChapter>
            )}
          </div>
        );
      }

      // 12. VIBRANT INTERACTIVE FAMILY MAJLIS SALON & GUARDIANS OF MEMORY
      case 'majlis':
        return wrapInStandardContainer(
          <HeritageSectionPavilion
            id={`portal-sec-${key}`}
            compactPreview={compactPreview}
          >
            <HeritagePavilionHeader
              kicker="حوار العائلة وتكريم المساهمين"
              title="مجلس العائلة وحرّاس الذاكرة"
              icon={<MessageSquare className="w-3.5 h-3.5" />}
            />

            {/* Guardians of Memory Honor Bar */}
            {cms.majlisAndGuardiansModule.showGuardiansHonorRoll &&
              guardians.length > 0 && (
                <div
                  className="rounded-2xl border p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--fs-gold-soft) 0%, var(--fs-surface) 100%)',
                    borderColor:
                      'color-mix(in srgb, var(--fs-gold) 44%, transparent)',
                  }}
                >
                  <div className="text-xs font-bold fs-accent-text flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 fs-gold-text shrink-0" />
                    <span>وسام شرف حرّاس ذاكرة العائلة الأكثر إثراءً:</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-bold tabular-nums">
                    {guardians.map((g, i) => (
                      <span key={`${g.name}-${i}`} className="inline-flex items-center gap-1">
                        <span className="fs-gold-text">✦</span>
                        <span>{g.name}</span>
                        <span className="fs-muted font-semibold">
                          ({g.approvedCount} إثراء)
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {/* Vibrant Interactive Majlis Topic Threads */}
            <div className="space-y-6">
              {cms.majlisAndGuardiansModule.topics.map((topic) => {
                const replies = topic.replies || [];
                const reactions = topic.reactions || {
                  greatIdea: 0,
                  withYou: 0,
                  blessGathering: 0,
                };
                return (
                  <article
                    key={topic.id}
                    className="rounded-3xl fs-surface border overflow-hidden shadow-[0_14px_38px_-18px_rgba(32,22,14,0.16)]"
                    style={{
                      borderColor:
                        'color-mix(in srgb, var(--fs-gold) 44%, transparent)',
                    }}
                  >
                    {/* Pinned Majlis Topic Header Banner */}
                    <div
                      className="p-5 sm:p-7 border-b fs-border space-y-4"
                      style={{
                        background:
                          'linear-gradient(135deg, var(--fs-gold-soft) 0%, var(--fs-surface) 75%)',
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="inline-flex items-center gap-1.5 font-bold fs-accent-text">
                          {topic.isWeeklyElderPrompt ? (
                            <Pin className="w-3.5 h-3.5 fs-gold-text" />
                          ) : (
                            <MessageSquare className="w-3.5 h-3.5 fs-gold-text" />
                          )}
                          <span>
                            {topic.isWeeklyElderPrompt
                              ? 'محور مثبّت في مجلس العائلة'
                              : 'محور حوار في ديوان العائلة'}
                          </span>
                        </div>
                        {!topic.isLocked && (
                          <span className="text-[11px] font-bold fs-accent-text inline-flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 fs-gold-text" />
                            <span>باب النقاش مفتوح الآن</span>
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-lg sm:text-xl font-bold fs-display-font leading-snug">
                          {topic.title}
                        </h3>
                        <p className="text-sm sm:text-[15px] leading-relaxed font-medium opacity-90">
                          {topic.promptQuestion}
                        </p>
                      </div>

                      {/* One-Click Quick Reaction Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {MAJLIS_REACTION_META.map((rx) => {
                          const guardKey = `${topic.id}:${rx.key}`;
                          const isReacted = Boolean(
                            reactedMajlisKeys[guardKey]
                          );
                          const count = reactions[rx.key] || 0;
                          return (
                            <button
                              key={rx.key}
                              type="button"
                              disabled={compactPreview || isReacted}
                              onClick={() =>
                                handleMajlisReaction(topic.id, rx.key)
                              }
                              className="px-3.5 py-1.5 rounded-full border text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-default tabular-nums"
                              style={
                                isReacted
                                  ? {
                                      backgroundColor: 'var(--fs-accent)',
                                      borderColor: 'var(--fs-accent)',
                                      color: '#FFFFFF',
                                    }
                                  : {
                                      backgroundColor: 'var(--fs-surface)',
                                      borderColor:
                                        'color-mix(in srgb, var(--fs-gold) 45%, transparent)',
                                      color: 'var(--fs-accent)',
                                    }
                              }
                            >
                              <ThumbsUp className="w-3 h-3" />
                              <span>{rx.label}</span>
                              {count > 0 && (
                                <span className="opacity-85">({count})</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Threaded Majlis Replies OR Inviting First-Voice Welcome Card */}
                    <div className="p-5 sm:p-7 space-y-5">
                      {replies.length > 0 ? (
                        <div className="space-y-3">
                          <div className="text-[11px] font-bold fs-muted tabular-nums">
                            ✦ مشاركات أفراد العائلة ({replies.length})
                          </div>
                          {replies.map((rep) => (
                            <div
                              key={rep.id}
                              className="rounded-2xl fs-surface-alt border fs-border px-4 py-3.5 flex items-start gap-3.5"
                            >
                              <div
                                className="w-9 h-9 rounded-full border-2 flex items-center justify-center font-bold fs-display-font shrink-0 text-xs shadow-2xs"
                                style={{
                                  backgroundColor: 'var(--fs-surface)',
                                  borderColor:
                                    'color-mix(in srgb, var(--fs-gold) 52%, transparent)',
                                  color: 'var(--fs-accent)',
                                }}
                              >
                                {getArabicMonogram(rep.authorName)}
                              </div>
                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs sm:text-sm font-bold fs-accent-text">
                                    {rep.authorName}
                                  </span>
                                  {rep.createdAt && (
                                    <span className="text-[10.5px] fs-muted tabular-nums">
                                      {formatArabicLongDate(rep.createdAt)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs sm:text-sm leading-relaxed">
                                  {rep.body}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div
                          className="rounded-2xl border border-dashed p-5 text-center space-y-1.5"
                          style={{
                            borderColor:
                              'color-mix(in srgb, var(--fs-gold) 45%, transparent)',
                            backgroundColor: 'var(--fs-surface-alt)',
                          }}
                        >
                          <div className="text-xs font-bold fs-accent-text">
                            ✦ ديوان العائلة بانتظار صوتك الأول
                          </div>
                          <p className="text-xs fs-muted leading-relaxed max-w-md mx-auto">
                            كن أول من يفتتح الحديث في مجلس عائلة{' '}
                            {siteData.familyName} وشارك أهلك رأيك وذكرياتك أدناه.
                          </p>
                        </div>
                      )}

                      {/* Guestbook Reply Composer with One-Click Quick Phrases */}
                      {!topic.isLocked && !compactPreview && (
                        <div className="pt-4 border-t border-dashed fs-border space-y-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-bold fs-muted ml-1">
                              عبارات سريعة:
                            </span>
                            {MAJLIS_QUICK_PHRASES.map((phrase) => (
                              <button
                                key={phrase}
                                type="button"
                                onClick={() =>
                                  setMajlisReplyInputs((prev) => ({
                                    ...prev,
                                    [topic.id]: {
                                      name: prev[topic.id]?.name || '',
                                      body: phrase,
                                    },
                                  }))
                                }
                                className="px-2.5 py-1 rounded-lg fs-surface-alt border fs-border text-[11px] font-semibold fs-accent-text hover:opacity-85 transition-opacity cursor-pointer"
                              >
                                + {phrase}
                              </button>
                            ))}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
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
                              className="sm:col-span-4 px-3.5 py-2.5 rounded-xl fs-surface-alt border fs-border text-xs focus:outline-none focus:ring-1"
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
                              className="sm:col-span-6 px-3.5 py-2.5 rounded-xl fs-surface-alt border fs-border text-xs focus:outline-none focus:ring-1"
                              style={{
                                ['--tw-ring-color' as string]: 'var(--fs-gold)',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSubmitMajlisReply(topic.id)}
                              className="sm:col-span-2 py-2.5 px-3.5 rounded-xl fs-accent-bg text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-95 transition-opacity shadow-xs"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>إرسال</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </HeritageSectionPavilion>,
          key
        );
    }
  };

  // ===========================================================================
  // SMART BENTO CHAPTER PAIRING (RESPECTS EXACT `sectionOrder`, ZERO HALF-EMPTY ROWS)
  // ===========================================================================
  const buildEditorialChapterBlocks = (): Array<{
    key: string;
    sectionKeys: PortalSectionKey[];
    node: React.ReactNode;
  }> => {
    const blocks: Array<{
      key: string;
      sectionKeys: PortalSectionKey[];
      node: React.ReactNode;
    }> = [];
    let i = 0;

    while (i < orderedActiveSections.length) {
      const cur = orderedActiveSections[i];
      const next = orderedActiveSections[i + 1];

      // Pair 1: patriarch_quote + atlas (either adjacent order, when atlas <= 3 locations)
      if (
        !compactPreview &&
        next &&
        ((cur === 'patriarch_quote' && next === 'atlas') ||
          (cur === 'atlas' && next === 'patriarch_quote')) &&
        cms.atlasAndStatsModule.locations.length <= 3
      ) {
        const quoteFirst = cur === 'patriarch_quote';
        blocks.push({
          key: `bento-${cur}-${next}`,
          sectionKeys: [cur, next],
          node: wrapInStandardContainer(
            <OpenEditorialCanvasSection
              id="portal-bento-roots-atlas"
              compactPreview={compactPreview}
              watermarkVariant="topographic_map"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div
                  className={
                    quoteFirst ? 'lg:col-span-5' : 'lg:col-span-5 lg:order-2'
                  }
                >
                  {renderPatriarchQuoteBlock(true)}
                </div>
                <div
                  id="portal-sec-atlas"
                  className={`${
                    quoteFirst ? 'lg:col-span-7' : 'lg:col-span-7 lg:order-1'
                  } scroll-mt-24 flex flex-col justify-center space-y-5`}
                >
                  <HeritagePavilionHeader
                    kicker="الانتشار الجغرافي والديار"
                    title="أطلس ديار وحواضر العائلة"
                    icon={<MapPin className="w-3.5 h-3.5" />}
                  />
                  {renderAtlasCards(true)}
                </div>
              </div>
            </OpenEditorialCanvasSection>,
            `bento-${cur}-${next}`
          ),
        });
        i += 2;
        continue;
      }

      // Pair 2: notables + professions (either adjacent order, when each <= 2 items)
      if (
        !compactPreview &&
        next &&
        ((cur === 'notables' && next === 'professions') ||
          (cur === 'professions' && next === 'notables')) &&
        cms.notablesModule.items.length <= 2 &&
        cms.professionsModule.items.length <= 2
      ) {
        const notablesFirst = cur === 'notables';
        blocks.push({
          key: `bento-${cur}-${next}`,
          sectionKeys: [cur, next],
          node: wrapInStandardContainer(
            <OpenEditorialCanvasSection
              id="portal-bento-honors-talent"
              compactPreview={compactPreview}
              watermarkVariant="arabesque"
            >
              <HeritagePavilionHeader
                kicker="مفخرة العائلة وتكافل خبراتها"
                title="مفخرة العائلة وكفاءاتها"
                icon={<Award className="w-3.5 h-3.5" />}
              />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div
                  id="portal-sec-notables"
                  className={`${
                    notablesFirst ? 'lg:col-span-6' : 'lg:col-span-6 lg:order-2'
                  } scroll-mt-24 space-y-4`}
                >
                  <div className="text-xs font-bold fs-accent-text tracking-wide">
                    ✦ لوحة الشرف والأعلام
                  </div>
                  {renderNotablesCards(true)}
                </div>
                <div
                  id="portal-sec-professions"
                  className={`${
                    notablesFirst ? 'lg:col-span-6' : 'lg:col-span-6 lg:order-1'
                  } scroll-mt-24 space-y-4`}
                >
                  <div className="text-xs font-bold fs-accent-text tracking-wide">
                    ✦ دليل الكفاءات والتخصصات
                  </div>
                  {renderProfessionsCards(true)}
                </div>
              </div>
            </OpenEditorialCanvasSection>,
            `bento-${cur}-${next}`
          ),
        });
        i += 2;
        continue;
      }

      // Pair 3: stories + oral_heritage (either adjacent order, when each <= 2 items)
      if (
        !compactPreview &&
        next &&
        ((cur === 'stories' && next === 'oral_heritage') ||
          (cur === 'oral_heritage' && next === 'stories')) &&
        cms.storiesModule.items.length <= 2 &&
        cms.oralHeritageModule.items.length <= 2
      ) {
        const storiesFirst = cur === 'stories';
        blocks.push({
          key: `bento-${cur}-${next}`,
          sectionKeys: [cur, next],
          node: wrapInStandardContainer(
            <OpenEditorialCanvasSection
              id="portal-bento-stories-oral"
              compactPreview={compactPreview}
              watermarkVariant="storybook_open"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div
                  id="portal-sec-stories"
                  className={`${
                    storiesFirst ? 'lg:col-span-6' : 'lg:col-span-6 lg:order-2'
                  } scroll-mt-24 space-y-5`}
                >
                  <HeritagePavilionHeader
                    kicker="سِير ومواقف خالدة"
                    title="قصص الأجداد"
                    icon={<BookOpen className="w-3.5 h-3.5" />}
                  />
                  {renderStoriesCards(true)}
                </div>
                <div
                  id="portal-sec-oral_heritage"
                  className={`${
                    storiesFirst ? 'lg:col-span-6' : 'lg:col-span-6 lg:order-1'
                  } scroll-mt-24 space-y-5`}
                >
                  <HeritagePavilionHeader
                    kicker="أصوات وقصائد ومرويات"
                    title="الموروث الصوتي والشعري"
                    icon={<Mic className="w-3.5 h-3.5" />}
                  />
                  {renderOralHeritageCards(true)}
                </div>
              </div>
            </OpenEditorialCanvasSection>,
            `bento-${cur}-${next}`
          ),
        });
        i += 2;
        continue;
      }

      // Pair 4: news + events (either adjacent order, when each <= 2 items)
      if (
        !compactPreview &&
        next &&
        ((cur === 'news' && next === 'events') ||
          (cur === 'events' && next === 'news')) &&
        cms.newsModule.items.length <= 2 &&
        cms.eventsModule.items.length <= 2
      ) {
        const newsFirst = cur === 'news';
        blocks.push({
          key: `bento-${cur}-${next}`,
          sectionKeys: [cur, next],
          node: wrapInStandardContainer(
            <OpenEditorialCanvasSection
              id="portal-bento-news-events"
              compactPreview={compactPreview}
              watermarkVariant="festive_chandelier"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div
                  id="portal-sec-news"
                  className={`${
                    newsFirst ? 'lg:col-span-6' : 'lg:col-span-6 lg:order-2'
                  } scroll-mt-24 space-y-5`}
                >
                  <HeritagePavilionHeader
                    kicker="تباشير وأفراح العائلة"
                    title="أخبار ومستجدات العائلة"
                    icon={<Sparkles className="w-3.5 h-3.5" />}
                  />
                  {renderNewsCards(true)}
                </div>
                <div
                  id="portal-sec-events"
                  className={`${
                    newsFirst ? 'lg:col-span-6' : 'lg:col-span-6 lg:order-1'
                  } scroll-mt-24 space-y-5`}
                >
                  <HeritagePavilionHeader
                    kicker="لقاءات وصلة رحم"
                    title="المناسبات والملتقيات"
                    icon={<Calendar className="w-3.5 h-3.5" />}
                  />
                  {renderEventsCards(true)}
                </div>
              </div>
            </OpenEditorialCanvasSection>,
            `bento-${cur}-${next}`
          ),
        });
        i += 2;
        continue;
      }

      blocks.push({
        key: cur,
        sectionKeys: [cur],
        node: renderStandaloneSection(cur),
      });
      i += 1;
    }

    return blocks;
  };

  const editorialChapterBlocks = buildEditorialChapterBlocks();

  // STRICTLY ONE EMOTIONAL INTERLUDE SLOT (RESPECTS EXACT STUDIO PLACEMENT CHOICE)
  const singleInterludeSlot = (() => {
    if (
      !branding.emotionalInterlude.enabled ||
      editorialChapterBlocks.length === 0
    ) {
      return { beforeFirst: false, afterIdx: -1 };
    }
    const pos = branding.emotionalInterlude.position;
    const findBlockIdx = (targets: PortalSectionKey[]) =>
      editorialChapterBlocks.findIndex((b) =>
        b.sectionKeys.some((k) => targets.includes(k))
      );

    if (pos === 'after_tree') {
      const idx = findBlockIdx(['tree_mirror']);
      return {
        beforeFirst: false,
        afterIdx: idx >= 0 ? idx : 0,
      };
    }
    if (pos === 'after_welcome_atlas') {
      const idx = findBlockIdx(['atlas', 'patriarch_quote']);
      return {
        beforeFirst: false,
        afterIdx: idx >= 0 ? idx : 0,
      };
    }
    if (pos === 'after_vault') {
      const idx = findBlockIdx(['vault_gallery']);
      return {
        beforeFirst: false,
        afterIdx:
          idx >= 0
            ? idx
            : Math.min(
                editorialChapterBlocks.length - 1,
                Math.floor(editorialChapterBlocks.length / 2)
              ),
      };
    }
    // 'before_memorial'
    const memIdx = findBlockIdx(['memorial']);
    if (memIdx === 0) {
      return { beforeFirst: true, afterIdx: -1 };
    }
    if (memIdx > 0) {
      return { beforeFirst: false, afterIdx: memIdx - 1 };
    }
    return {
      beforeFirst: false,
      afterIdx: Math.max(0, editorialChapterBlocks.length - 2),
    };
  })();

  // Curated concise primary nav links (max 5 clean single-line links so Diwan title never truncates)
  const curatedNavSections = (() => {
    if (orderedActiveSections.length <= 5) return orderedActiveSections;
    const priorityOrder: PortalSectionKey[] = [
      'tree_mirror',
      'vault_gallery',
      'atlas',
      'notables',
      'stories',
      'news',
      'events',
      'majlis',
      'memorial',
      'patriarch_quote',
      'oral_heritage',
      'professions',
    ];
    const topFiveSet = new Set(
      priorityOrder
        .filter((k) => orderedActiveSections.includes(k))
        .slice(0, 5)
    );
    return orderedActiveSections.filter((k) => topFiveSet.has(k));
  })();

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
        onTimeUpdate={(e) =>
          setAudioCurrentTime(e.currentTarget.currentTime || 0)
        }
        onLoadedMetadata={(e) =>
          setAudioDuration(e.currentTarget.duration || 0)
        }
        onEnded={() => {
          setPlayingClipId(null);
          setAudioCurrentTime(0);
        }}
        className="hidden"
      />

      {/* ================================================================= */}
      {/* 1. WARM GLASS STICKY TOP NAVIGATION BAR (UNTRUNCATED TITLE + 2px GOLD PROGRESS) */}
      {/* ================================================================= */}
      <header
        className="sticky top-0 z-30 fs-nav-glass border-b shadow-[0_2px_16px_rgba(44,30,20,0.04)] relative"
        style={{
          borderColor: 'color-mix(in srgb, var(--fs-gold) 28%, transparent)',
        }}
      >
        <ScrollProgressGoldBar disabled={compactPreview} />
        <div
          className={`${
            compactPreview
              ? 'px-4 py-2.5'
              : 'max-w-6xl mx-auto px-4 sm:px-6 py-3'
          } flex items-center justify-between gap-4`}
        >
          {/* Right: Mini Crest + Full Uncropped Diwan Family Title */}
          <div className="flex items-center gap-2.5 shrink-0 max-w-[230px] sm:max-w-none">
            <FamilyCrestEmblem
              familyName={siteData.familyName}
              crestMode={branding.crestMode}
              crestStyle={branding.crestStyle}
              customCrestUrl={branding.customCrestUrl}
              size="xs"
            />
            <span className="text-sm sm:text-base font-bold fs-display-font truncate sm:overflow-visible sm:whitespace-nowrap">
              {portalTitle}
            </span>
          </div>

          {/* Center: Curated Primary Anchor Links (Max 5 Concise Text Links — Never Crowds Title) */}
          {!compactPreview && curatedNavSections.length > 0 && (
            <nav
              aria-label="أقسام البوابة"
              className="hidden lg:flex items-center gap-5 text-xs font-bold"
            >
              {curatedNavSections.map((secKey) => {
                const isActive = activeNavSection === secKey;
                return (
                  <button
                    key={secKey}
                    type="button"
                    onClick={() => scrollToSection(secKey)}
                    className={`relative py-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'fs-accent-text'
                        : 'opacity-75 hover:opacity-100'
                    }`}
                  >
                    <span>{SECTION_SHORT_NAV[secKey]}</span>
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-0 h-[2px] rounded-full"
                        style={{ backgroundColor: 'var(--fs-gold)' }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Left: Share Diwan + Juthori Auth Profile Capsule / Login */}
          <div className="flex items-center gap-2 shrink-0">
            {!compactPreview && (
              <>
                <button
                  type="button"
                  data-testid="public-header-share-btn"
                  onClick={() => setShowQrModal(true)}
                  className="h-9 px-3.5 rounded-xl fs-surface border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 whitespace-nowrap shrink-0 shadow-2xs transition-opacity"
                  style={{
                    borderColor:
                      'color-mix(in srgb, var(--fs-gold) 45%, transparent)',
                  }}
                >
                  <QrCode className="w-3.5 h-3.5 fs-accent-text" />
                  <span className="hidden sm:inline">
                    مشاركة موقع ديوان العائلة
                  </span>
                </button>

                {signedInUser ? (
                  <div ref={profileDropdownRef} className="relative shrink-0">
                    <button
                      type="button"
                      data-testid="public-header-profile-capsule"
                      onClick={() => setShowProfileDropdown((v) => !v)}
                      aria-expanded={showProfileDropdown}
                      className="h-9 pr-1.5 pl-2.5 rounded-xl fs-surface border inline-flex items-center gap-2 cursor-pointer hover:opacity-95 transition-opacity whitespace-nowrap shrink-0 shadow-2xs"
                      style={{
                        borderColor:
                          'color-mix(in srgb, var(--fs-gold) 60%, transparent)',
                      }}
                    >
                      <span
                        className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-[11px] font-bold shrink-0 ring-1 ring-[#D8C7B2] bg-[#E8DED2] text-[#D97757]"
                      >
                        {viewerAvatarUrl || signedInUser.photoURL ? (
                          <img
                            src={viewerAvatarUrl || signedInUser.photoURL || ''}
                            alt={portalViewerDisplayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          getArabicMonogram(portalViewerDisplayName)
                        )}
                      </span>
                      <span className="hidden md:flex flex-col items-start leading-tight text-right">
                        <span className="text-[11px] font-bold max-w-[120px] truncate">
                          {portalViewerDisplayName}
                        </span>
                        <span className="text-[9.5px] fs-accent-text font-semibold">
                          {portalViewerRoleBadge}
                        </span>
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-70 shrink-0" />
                    </button>

                    {showProfileDropdown && (
                      <div
                        role="menu"
                        data-testid="public-header-profile-menu"
                        className="absolute left-0 mt-2 w-60 rounded-2xl fs-surface border shadow-xl p-1.5 z-50 text-right"
                        style={{
                          borderColor:
                            'color-mix(in srgb, var(--fs-gold) 45%, transparent)',
                        }}
                      >
                        <div className="px-3 py-2 border-b fs-border mb-1">
                          <div className="text-xs font-bold truncate">
                            {portalViewerDisplayName}
                          </div>
                          <div className="text-[10.5px] fs-accent-text font-semibold">
                            {portalViewerRoleBadge}
                          </div>
                        </div>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowProfileDropdown(false);
                            if (onGoToOwnDashboard) {
                              onGoToOwnDashboard();
                            } else {
                              onExitToMainApp();
                            }
                          }}
                          className="w-full px-3 py-2 rounded-xl text-xs font-bold hover:bg-black/5 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <LayoutDashboard className="w-3.5 h-3.5 fs-accent-text shrink-0" />
                          <span>الانتقال إلى لوحة تحكم جذوري</span>
                        </button>

                        {accessGate.isOwner && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setShowProfileDropdown(false);
                              if (onGoToOwnSiteSettings) {
                                onGoToOwnSiteSettings();
                              } else if (onGoToOwnDashboard) {
                                onGoToOwnDashboard();
                              } else {
                                onExitToMainApp();
                              }
                            }}
                            className="w-full px-3 py-2 rounded-xl text-xs font-bold hover:bg-black/5 flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <Settings className="w-3.5 h-3.5 fs-accent-text shrink-0" />
                            <span>إعدادات موقعي</span>
                          </button>
                        )}

                        <div className="my-1 border-t fs-border" />

                        <button
                          type="button"
                          role="menuitem"
                          data-testid="public-header-logout-btn"
                          onClick={handlePortalLogout}
                          className="w-full px-3 py-2 rounded-xl text-xs font-bold text-red-700 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5 shrink-0" />
                          <span>تسجيل الخروج</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {accessCodeUnlocked && accessGate.isRestrictedSite && (
                      <button
                        type="button"
                        data-testid="public-header-lock-session-btn"
                        onClick={handleLockPasscodeSession}
                        title="قفل جلسة رمز العائلة"
                        className="h-9 px-3 rounded-xl fs-surface border fs-border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:bg-red-50 hover:text-red-800 whitespace-nowrap shrink-0 transition-colors"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">قفل الجلسة</span>
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid="public-header-login-btn"
                      onClick={() => setShowPortalLoginModal(true)}
                      className="h-9 px-3.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 shadow-2xs transition-colors"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>تسجيل الدخول</span>
                    </button>
                  </div>
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
            <div className="max-w-3xl mx-auto rounded-3xl bg-[#FAF7F2]/92 backdrop-blur-md border border-[#D8C7B2] text-[#1F1F1C] p-6 sm:p-10 text-center flex flex-col items-center space-y-4 shadow-xl">
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

      {/* FLOATING HERITAGE STATS BAR (LIVE COUNT-UP + ZERO-FREE) */}
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
                  {typeof metric.value === 'number' ? (
                    <AnimatedHeritageCounter
                      value={metric.value}
                      disabled={compactPreview}
                    />
                  ) : (
                    metric.value
                  )}
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
      {/* 3. EDITORIAL SCROLLYTELLING CHAPTERS + VELVET BANDS + INTERLUDES  */}
      {/* ================================================================= */}
      <main
        className={`relative flex-1 w-full ${
          compactPreview
            ? 'py-6 space-y-6'
            : 'py-8 sm:py-12 space-y-8 sm:space-y-12'
        }`}
      >
        {/* Subtle Illuminated Vertical Lineage Thread (Desktop xl rail) */}
        {!compactPreview && editorialChapterBlocks.length > 1 && (
          <div
            aria-hidden="true"
            className="hidden xl:block pointer-events-none absolute inset-y-12 left-1/2 -translate-x-1/2 w-full max-w-6xl"
          >
            <div
              className="absolute -right-[14px] top-0 bottom-0 w-px opacity-35"
              style={{
                background:
                  'linear-gradient(180deg, transparent 0%, var(--fs-gold) 12%, var(--fs-gold) 88%, transparent 100%)',
              }}
            />
          </div>
        )}

        {/* Strictly Single Emotional Interlude if positioned before block 0 */}
        {singleInterludeSlot.beforeFirst &&
          wrapInStandardContainer(
            <SingleEmotionalInterludeShowcase
              config={branding.emotionalInterlude}
              familyName={siteData.familyName}
              compactPreview={compactPreview}
            />,
            'single-emotional-interlude',
            false
          )}

        {editorialChapterBlocks.map((block, idx) => (
          <React.Fragment key={block.key}>
            {block.node}

            {/* Strictly Single Editorial Emotional Interlude Showcase */}
            {idx === singleInterludeSlot.afterIdx &&
              wrapInStandardContainer(
                <SingleEmotionalInterludeShowcase
                  config={branding.emotionalInterlude}
                  familyName={siteData.familyName}
                  compactPreview={compactPreview}
                />,
                'single-emotional-interlude',
                false
              )}
          </React.Fragment>
        ))}

        {/* Transparent Owner-Only Studio Note for Hidden Empty Sections */}
        {isOwnerPreview &&
          hiddenEmptySectionsForOwner.length > 0 &&
          wrapInStandardContainer(
            <div className="rounded-2xl border border-dashed fs-border fs-surface-alt/75 p-4 flex items-start gap-3 text-xs">
              <EyeOff className="w-4 h-4 fs-accent-text shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold">
                  ملاحظة استوديو أمين السجل (لا تظهر للزوار):
                </div>
                <p className="fs-muted leading-relaxed">
                  تم إخفاء الأقسام التالية تلقائياً من الموقع الحي لعدم إضافة
                  محتوى فيها بعد:{' '}
                  <strong className="fs-accent-text">
                    {hiddenEmptySectionsForOwner
                      .map((k) => PORTAL_SECTION_LABELS[k])
                      .join(' · ')}
                  </strong>
                  . ستظهر فوراً بتصميمها الكامل بمجرد إضافة أول عنصر فيها من
                  لوحة «موقعي».
                </p>
              </div>
            </div>,
            'owner-hidden-note',
            false
          )}

        {/* =============================================================== */}
        {/* PEAK-END LUXURY JUTHORI SIGNATURE BANNER                        */}
        {/* =============================================================== */}
        {wrapInStandardContainer(
          <section
            data-testid="juthori-peak-end-signature-banner"
            className={`relative overflow-hidden rounded-3xl fs-surface border shadow-[0_18px_46px_-22px_rgba(32,22,14,0.22)] ${
              compactPreview ? 'p-5' : 'p-6 sm:p-8 lg:p-10'
            }`}
            style={{
              borderColor: 'color-mix(in srgb, var(--fs-gold) 52%, transparent)',
              background:
                'linear-gradient(135deg, var(--fs-surface) 0%, var(--fs-surface-alt) 58%, var(--fs-gold-soft) 100%)',
            }}
          >
            {/* Gilded Top & Bottom Hairline Accents */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-10 top-0 h-[1.5px]"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, var(--fs-gold) 50%, transparent 100%)',
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-2 rounded-[20px] border opacity-30"
              style={{ borderColor: 'var(--fs-gold)' }}
            />

            {/* Quiet Andalusian Geometric Corner Filigree Watermark */}
            <svg
              aria-hidden="true"
              viewBox="0 0 220 220"
              className="pointer-events-none select-none absolute -left-8 -bottom-10 w-44 h-44 sm:w-56 sm:h-56 opacity-[0.14]"
              style={{ color: 'var(--fs-gold)' }}
            >
              <g fill="none" stroke="currentColor" strokeWidth="1">
                <circle cx="110" cy="110" r="94" strokeDasharray="3 4" />
                <circle cx="110" cy="110" r="68" />
                <rect
                  x="56"
                  y="56"
                  width="108"
                  height="108"
                  transform="rotate(45 110 110)"
                />
                <rect x="56" y="56" width="108" height="108" />
                <polygon points="110,28 130,86 192,110 130,134 110,192 90,134 28,110 90,86" />
                <circle cx="110" cy="110" r="22" />
              </g>
            </svg>
            <svg
              aria-hidden="true"
              viewBox="0 0 160 160"
              className="pointer-events-none select-none absolute -right-6 -top-8 w-32 h-32 opacity-[0.1]"
              style={{ color: 'var(--fs-gold)' }}
            >
              <g fill="none" stroke="currentColor" strokeWidth="0.9">
                <circle cx="80" cy="80" r="62" />
                <rect
                  x="38"
                  y="38"
                  width="84"
                  height="84"
                  transform="rotate(45 80 80)"
                />
                <rect x="38" y="38" width="84" height="84" />
              </g>
            </svg>

            <div
              className={`relative z-10 flex ${
                compactPreview
                  ? 'flex-col items-center text-center gap-4'
                  : 'flex-col lg:flex-row lg:items-center justify-between gap-6'
              }`}
            >
              {/* Right: Official Juthori Logo + Heritage Value Proposition */}
              <div
                className={`flex ${
                  compactPreview
                    ? 'flex-col items-center text-center gap-3'
                    : 'flex-col sm:flex-row sm:items-center gap-4 sm:gap-5'
                } min-w-0 flex-1`}
              >
                <div
                  className="p-2 rounded-2xl border shadow-xs shrink-0"
                  style={{
                    backgroundColor: 'var(--fs-surface)',
                    borderColor:
                      'color-mix(in srgb, var(--fs-gold) 45%, transparent)',
                  }}
                >
                  <JuthoriLogo size={compactPreview ? 'sm' : 'md'} />
                </div>

                <div className="space-y-1.5 min-w-0">
                  <div className="text-[11px] font-bold fs-accent-text tracking-wide">
                    ✦ موثّق عبر منصة جذوري للأنساب والإرث العائلي
                  </div>
                  <h2
                    className={`${
                      compactPreview
                        ? 'text-base leading-snug'
                        : 'text-lg sm:text-xl lg:text-2xl leading-snug'
                    } font-bold fs-display-font text-balance`}
                  >
                    هل تودّ تأسيس ديوان رقمي فاخر وتوثيق عمود النسب التاريخي
                    لعائلتك؟
                  </h2>
                  <p className="text-xs sm:text-sm fs-muted leading-relaxed max-w-2xl">
                    انضم إلى العائلات الموثقة في جذوري — استكشف الجذور
                    التاريخية، ابنِ مشجرتك التفاعلية، وأطلق موقع عائلتك الخاص في
                    دقائق.
                  </p>
                </div>
              </div>

              {/* Left: Dual Heritage CTAs */}
              <div
                className={`flex ${
                  compactPreview
                    ? 'flex-col w-full gap-2'
                    : 'flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-2.5 shrink-0'
                }`}
              >
                <button
                  type="button"
                  onClick={onStartOwnLineageSearch || onExitToMainApp}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl fs-accent-bg text-xs sm:text-sm font-bold shadow-sm hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap"
                >
                  <span>أسّس ديوان عائلتك في جذوري</span>
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={onExitToMainApp}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl fs-surface border text-xs sm:text-sm font-bold fs-accent-text hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap shadow-2xs"
                  style={{
                    borderColor:
                      'color-mix(in srgb, var(--fs-gold) 48%, transparent)',
                  }}
                >
                  <Compass className="w-4 h-4 shrink-0" />
                  <span>استكشف مرصد الأنساب</span>
                </button>
              </div>
            </div>
          </section>,
          'peak-end-signature-banner',
          false
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
            {orderedActiveSections.map((secKey) => (
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
      {/* MODALS: ENRICHMENT PROPOSAL, QR CARD, INVITE CLAIM                */}
      {/* ================================================================= */}

      {showEnrichmentModal && !compactPreview && canProposeEnrichment && (
        <div
          data-testid="vault-gift-modal"
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-3xl fs-surface border fs-border p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b fs-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl fs-surface-alt border fs-border flex items-center justify-center shrink-0">
                  <Camera className="w-4 h-4 fs-accent-text" />
                </div>
                <div>
                  <h3 className="text-base font-bold fs-display-font">
                    إهداء صورة أو وثيقة لخزانة عائلة {siteData.familyName}
                  </h3>
                  <p className="text-[11px] fs-muted">
                    صفتك: {enrichmentPermission.viewerRoleLabel}
                  </p>
                </div>
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
                  placeholder="السنة أو المناسبة (اختياري)"
                  className="w-full px-3 py-2 rounded-xl fs-surface-alt border fs-border text-xs"
                />
                <div className="rounded-xl fs-surface-alt border border-dashed fs-border p-3 space-y-2">
                  <label className="block text-[11px] font-bold fs-muted">
                    ارفق الصورة أو الوثيقة التاريخية
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEnrichmentMediaUpload}
                    className="w-full text-xs"
                  />
                  {enrMediaDataUrl && (
                    <img
                      src={enrMediaDataUrl}
                      alt={enrMediaTitle || 'معاينة الصورة المرفقة'}
                      className="h-28 w-auto rounded-xl object-cover border fs-border"
                    />
                  )}
                </div>

                <textarea
                  rows={2}
                  value={enrNotes}
                  onChange={(e) => setEnrNotes(e.target.value)}
                  placeholder="نبذة عن الصورة أو ملاحظات لأمين السجل..."
                  className="w-full px-3 py-2 rounded-xl fs-surface-alt border fs-border text-xs"
                />

                <button
                  type="submit"
                  disabled={enrSubmitting}
                  className="w-full py-2.5 rounded-xl fs-accent-bg text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {enrSubmitting
                    ? 'جاري إرسال الإهداء...'
                    : 'إرسال الصورة لاعتماد أمين السجل ✦'}
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

      {readingStoryModal && !compactPreview && (
        <StorybookReadingModal
          story={readingStoryModal}
          familyName={siteData.familyName}
          formatArabicLongDate={formatArabicLongDate}
          onClose={() => setReadingStoryModal(null)}
        />
      )}

      {showPortalLoginModal && !compactPreview && (
        <LoginModal
          isOpen={showPortalLoginModal}
          onClose={() => setShowPortalLoginModal(false)}
          onLoginSuccess={handlePortalLoginModalSuccess}
        />
      )}
    </div>
  );
};
