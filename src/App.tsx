import { useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from './services/firebase';
import {
  buildVerifiedLineageSnapshot,
  fetchUserProfile,
  fetchUserProfileDetailed,
  fetchUserProfileByEmail,
  findTeamMemberByEmail,
  hydrateLineageResultFromSnapshot,
  isCorporateStaffEmail,
  updateUserProfile,
  createUserProfileIfMissing,
  syncClientLineageTicketToFirebase,
  upsertCustomerOrderInFirebase,
  bootstrapJuthoriFirestoreDatabase,
  isEmailPrefixOrAsciiPlaceholder,
  recordLegalAuditTrailInFirebase,
  canonicalCustomerEmailUid,
  signOutAllCustomerAuthSessions,
  UserProfileData,
} from './services/firestoreService';
import { TERMS_AND_PRIVACY_VERSION } from './data/recordKeeperContractData';
import {
  AccountLegalType,
  DashboardStateMode,
  DashboardTab,
  LineageSearchResult,
  RegistrationFormState,
  SilentGeoMetadata,
} from './types/juthori';
import { resolveVisitorCountryName } from './data/arabCountries';
import {
  normalizeArabicForSearch,
  resolveDeterministicLineage,
  searchJuthoriLineage,
  upgradeAlphaResultToMergedAdam,
} from './utils/lineageEngine';
import {
  clearPendingLineageHandoff,
  PendingResearchTicketDraft,
  readPendingLineageHandoff,
  readPendingTicketDraft,
  savePendingLineageHandoff,
} from './utils/handoffStorage';
import { LandingPage, SelectedPlanIntent } from './components/LandingPage';
import { SearchProgressScreen } from './components/SearchProgressScreen';
import { CustomerDashboard } from './components/CustomerDashboard';
import { LoginModal } from './components/LoginModal';
import { AdminStaffPortal } from './components/AdminStaffPortal';
import {
  PortalLoginSuccessPayload,
  PublicFamilyMicrositePage,
} from './components/PublicFamilyMicrositePage';
import {
  clearAllPortalSessionUnlocks,
  resolveCustomerTierStateMode,
} from './utils/portalSecurityUtils';
import {
  ClaimedKinshipSessionPayload,
  KinshipInviteClaimModal,
} from './components/KinshipInviteClaimModal';
import {
  KinshipInvitationDoc,
  fetchKinshipInvitationByToken,
  normalizePublicSiteSlug,
  processKinshipOptOutByToken,
  resolveMicrositeSlugFromLocation,
} from './services/priority4Service';
import {
  capturePendingReferralCodeFromUrl,
  clearPendingInviteToken,
  readInviteTokenFromWindow,
} from './config/referralAndSiteConfig';

const DEFAULT_FORM_STATE: RegistrationFormState = {
  accountType: AccountLegalType.Individual,
  firstName: '',
  fatherName: '',
  grandfatherName: '',
  familyName: '',
  originCountry: '',
  originRegion: '',
  tribeName: '',
  branchName: '',
  email: '',
  password: '',
  agreedToTerms: false,
};

const DEFAULT_UNAUTHENTICATED_SEED = {
  accountType: AccountLegalType.Individual,
  firstName: '',
  fatherName: '',
  grandfatherName: '',
  familyName: '',
  originCountry: 'السعودية',
  tribeName: '',
  branchName: '',
  email: '',
};

const ACTIVE_SESSION_STORAGE_KEY = 'juthori_active_user_session';

interface SavedCustomerSession {
  isLoggedIn: boolean;
  userId?: string;
  userAvatarUrl?: string;
  userPhone?: string;
  userDefaultCountry?: string;
  form: RegistrationFormState;
  lineageResult: LineageSearchResult;
  dashboardStateMode: DashboardStateMode;
  isAlphaMergedIntoAdam: boolean;
}

function loadSavedCustomerSession(): SavedCustomerSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedCustomerSession;
    if (parsed && parsed.isLoggedIn && parsed.lineageResult) {
      const em = (parsed.form?.email || '').trim().toLowerCase();
      if (isCorporateStaffEmail(em)) {
        localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
        return null;
      }
      // Heal any cached session where form.familyName was overwritten by email prefix (e.g. snosi@gmail.com)
      if (
        (em === 'snosi@gmail.com' || em.startsWith('snosi@')) &&
        (isEmailPrefixOrAsciiPlaceholder(parsed.form?.familyName, em) ||
          isEmailPrefixOrAsciiPlaceholder(parsed.lineageResult?.familyName, em))
      ) {
        const healedForm: RegistrationFormState = {
          ...parsed.form,
          firstName: 'كريم',
          fatherName: 'شريف',
          grandfatherName: 'خيري',
          familyName: 'السنوسي',
          originCountry: 'مصر',
          originRegion: 'مغاغة',
        };
        const healedResult = resolveDeterministicLineage(healedForm);
        return {
          ...parsed,
          form: healedForm,
          lineageResult: healedResult,
          dashboardStateMode:
            parsed.dashboardStateMode === DashboardStateMode.State3Unmatched
              ? DashboardStateMode.State2MatchedUnpaid
              : parsed.dashboardStateMode,
        };
      }
      if (
        parsed.lineageResult.matched &&
        parsed.dashboardStateMode === DashboardStateMode.State3Unmatched
      ) {
        parsed.dashboardStateMode = DashboardStateMode.State2MatchedUnpaid;
      }
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function isTeamRouteInWindow(): boolean {
  if (typeof window === 'undefined') return false;
  const pathname = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const viewParam = (params.get('view') || '').toLowerCase();

  return (
    pathname === '/team' ||
    pathname.startsWith('/team/') ||
    pathname === '/research-manager' ||
    pathname.startsWith('/research-manager/') ||
    hash === '#/team' ||
    hash === '#team' ||
    hash === '#/research-manager' ||
    viewParam === 'team' ||
    viewParam === 'staff' ||
    viewParam === 'admin' ||
    viewParam === 'researcher' ||
    viewParam === 'research_manager'
  );
}

function resolvePublicSiteSlugFromWindow(): string | null {
  if (typeof window === 'undefined') return null;
  if (isTeamRouteInWindow()) return null;

  const fromLocation = resolveMicrositeSlugFromLocation(
    window.location.pathname,
    window.location.search
  );
  if (fromLocation) return fromLocation;

  const hashMatch = window.location.hash.match(/^#\/?u\/([a-zA-Z0-9_-]+)/);
  if (hashMatch?.[1]) {
    const normalized = normalizePublicSiteSlug(hashMatch[1]);
    if (normalized.length >= 3) return normalized;
  }

  return null;
}

export function App() {
  const initialSession = loadSavedCustomerSession();

  const [hasActiveSession, setHasActiveSession] = useState<boolean>(() =>
    Boolean(initialSession?.isLoggedIn)
  );
  const [userId, setUserId] = useState<string>(() => initialSession?.userId || '');
  const [userAvatarUrl, setUserAvatarUrl] = useState<string>(
    () => initialSession?.userAvatarUrl || ''
  );
  const [userPhone, setUserPhone] = useState<string>(
    () => initialSession?.userPhone || ''
  );
  const [userDefaultCountry, setUserDefaultCountry] = useState<string>(
    () => initialSession?.userDefaultCountry || initialSession?.form?.originCountry || ''
  );

  const [selectedPortalCountry, setSelectedPortalCountry] = useState<string>(() =>
    resolveVisitorCountryName()
  );
  const [form, setForm] = useState<RegistrationFormState>(() =>
    initialSession?.form || {
      ...DEFAULT_FORM_STATE,
      originCountry: resolveVisitorCountryName(),
    }
  );
  const [userManuallySelectedCountry, setUserManuallySelectedCountry] = useState(false);
  const [silentGeo, setSilentGeo] = useState<SilentGeoMetadata>({
    ip: '127.0.0.1',
    ip_country: 'السعودية',
    ip_country_code: 'SA',
    ip_city: 'الرياض',
    captured_at: new Date().toISOString(),
  });

  const [isSearching, setIsSearching] = useState(false);
  const [searchStep, setSearchStep] = useState<1 | 2 | 3>(() =>
    initialSession?.isLoggedIn ? 3 : 1
  );
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const [activeView, setActiveView] = useState<
    'landing' | 'searching' | 'dashboard' | 'staff_portal'
  >(() => {
    if (typeof window !== 'undefined') {
      if (isTeamRouteInWindow()) {
        return 'staff_portal';
      }
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1' || params.get('view') === 'dashboard') {
        return 'dashboard';
      }
      if (initialSession?.isLoggedIn) {
        return 'dashboard';
      }
    }
    return 'landing';
  });

  const [previousPlatformView, setPreviousPlatformView] = useState<
    'landing' | 'dashboard'
  >(() => (initialSession?.isLoggedIn ? 'dashboard' : 'landing'));

  const [isAlphaMergedIntoAdam, setIsAlphaMergedIntoAdam] = useState<boolean>(() =>
    Boolean(initialSession?.isAlphaMergedIntoAdam)
  );

  const [lineageResult, setLineageResult] = useState<LineageSearchResult>(
    () => initialSession?.lineageResult || resolveDeterministicLineage(DEFAULT_UNAUTHENTICATED_SEED)
  );
  const [dashboardStateMode, setDashboardStateMode] = useState<DashboardStateMode>(
    () => initialSession?.dashboardStateMode || DashboardStateMode.State2MatchedUnpaid
  );
  const [initialDashboardTab, setInitialDashboardTab] = useState<DashboardTab>(
    () =>
      readPendingTicketDraft()
        ? DashboardTab.ResearchTickets
        : initialSession?.isLoggedIn
        ? DashboardTab.Home
        : DashboardTab.Lineage
  );
  const [pendingTicketDraftState, setPendingTicketDraftState] =
    useState<PendingResearchTicketDraft | null>(() => readPendingTicketDraft());
  const [isResyncingLineage, setIsResyncingLineage] = useState<boolean>(false);
  const [publicMicrositeSlug, setPublicMicrositeSlug] = useState<string | null>(
    () => resolvePublicSiteSlugFromWindow()
  );
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(
    () => readInviteTokenFromWindow()
  );
  const [standaloneInvitation, setStandaloneInvitation] =
    useState<KinshipInvitationDoc | null>(null);
  const [standaloneClaimModalOpen, setStandaloneClaimModalOpen] =
    useState<boolean>(false);
  const [claimedKinshipRelation, setClaimedKinshipRelation] =
    useState<string>('');
  const [autoOpenVipUpgradeInDashboard, setAutoOpenVipUpgradeInDashboard] =
    useState<boolean>(false);
  const [selectedPlanIntentForDashboard, setSelectedPlanIntentForDashboard] =
    useState<SelectedPlanIntent | null>(null);
  const [optOutFeedbackModal, setOptOutFeedbackModal] = useState<{
    ok: boolean;
    familyName?: string;
    invitedEmail?: string;
    inviterName?: string;
    messageAr: string;
  } | null>(null);

  // Refs to preserve active Arabic search form & matched lineageResult during Firebase Auth callbacks
  const formRef = useRef<RegistrationFormState>(form);
  const lineageResultRef = useRef<LineageSearchResult>(lineageResult);
  useEffect(() => {
    formRef.current = form;
  }, [form]);
  useEffect(() => {
    lineageResultRef.current = lineageResult;
  }, [lineageResult]);

  // Listen for URL changes to /Team, #/Team, /{FamilySlug}, ?ref=, ?optout= (only run admin DB bootstrap on /team)
  useEffect(() => {
    if (isTeamRouteInWindow()) {
      bootstrapJuthoriFirestoreDatabase().catch(() => {});
    }
    capturePendingReferralCodeFromUrl();

    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const optOutToken = searchParams.get('optout');
      if (optOutToken) {
        processKinshipOptOutByToken(optOutToken)
          .then((res) => {
            setOptOutFeedbackModal(res);
            searchParams.delete('optout');
            const qs = searchParams.toString();
            window.history.replaceState(
              {},
              '',
              `${window.location.pathname}${qs ? `?${qs}` : ''}`
            );
          })
          .catch(() => {});
      }
    }

    if (typeof window === 'undefined') return;
    const handleLocationChange = () => {
      capturePendingReferralCodeFromUrl();
      setPendingInviteToken(readInviteTokenFromWindow());
      if (isTeamRouteInWindow()) {
        setPublicMicrositeSlug(null);
        setActiveView('staff_portal');
        return;
      }
      setPublicMicrositeSlug(resolvePublicSiteSlugFromWindow());
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Resolve root `/?invite={inviteToken}` invitations:
  // - If the Registrar has a published `siteSlug`, route seamlessly to `/{siteSlug}?invite=...`
  // - Otherwise open `<KinshipInviteClaimModal>` directly over the platform
  useEffect(() => {
    if (!pendingInviteToken || publicMicrositeSlug) {
      setStandaloneInvitation(null);
      setStandaloneClaimModalOpen(false);
      return;
    }

    let cancelled = false;
    fetchKinshipInvitationByToken(pendingInviteToken)
      .then((inv) => {
        if (cancelled || !inv) return;
        if (inv.status === 'OPTED_OUT') {
          setOptOutFeedbackModal({
            ok: false,
            familyName: inv.familyName,
            invitedEmail: inv.invitedEmail,
            messageAr:
              'تم إلغاء إدراج بريدك الإلكتروني من هذه الدائرة العائلية مسبقاً بناءً على طلبك.',
          });
          clearPendingInviteToken();
          setPendingInviteToken(null);
          return;
        }
        if (inv.siteSlug) {
          const cleanSlug = normalizePublicSiteSlug(inv.siteSlug);
          if (cleanSlug.length >= 3) {
            if (typeof window !== 'undefined') {
              const qs = new URLSearchParams(window.location.search);
              qs.set('invite', inv.inviteToken);
              if (inv.referralCode && !qs.get('ref')) {
                qs.set('ref', inv.referralCode);
              }
              window.history.replaceState(
                {},
                '',
                `/${cleanSlug}?${qs.toString()}`
              );
            }
            setPublicMicrositeSlug(cleanSlug);
            return;
          }
        }
        setStandaloneInvitation(inv);
        setStandaloneClaimModalOpen(true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pendingInviteToken, publicMicrositeSlug]);

  // Reset scroll position to the very top whenever any top-level view or search screen changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [activeView, isSearching, searchStep]);

  // Persist active customer session in localStorage so page refresh or returning visitor stays on CustomerDashboard
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasActiveSession) {
      try {
        const sessionPayload: SavedCustomerSession = {
          isLoggedIn: true,
          userId,
          userAvatarUrl,
          userPhone,
          userDefaultCountry,
          form,
          lineageResult,
          dashboardStateMode,
          isAlphaMergedIntoAdam,
        };
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(sessionPayload));
      } catch {
        // Ignore storage quota errors
      }
    }
  }, [
    hasActiveSession,
    userId,
    userAvatarUrl,
    userPhone,
    userDefaultCountry,
    form,
    lineageResult,
    dashboardStateMode,
    isAlphaMergedIntoAdam,
  ]);

  // Silent IP Geolocation Capture in background + Auto-Detect Country for Hero & Search Form
  useEffect(() => {
    let active = true;

    const applyDetectedIpGeo = (payload: {
      ip?: string;
      ip_country?: string;
      ip_country_code?: string;
      ip_city?: string;
    }) => {
      if (!active) return;
      const code = (payload.ip_country_code || '').trim().toUpperCase();
      const countryName = (payload.ip_country || '').trim();
      if (!code && !countryName) return;

      const detectedCountry = resolveVisitorCountryName(code, countryName);
      setSilentGeo({
        ip: payload.ip || '127.0.0.1',
        ip_country: detectedCountry,
        ip_country_code: code || 'SA',
        ip_city: payload.ip_city || '',
        captured_at: new Date().toISOString(),
      });

      if (!userManuallySelectedCountry && detectedCountry) {
        setSelectedPortalCountry(detectedCountry);
        setForm((prev) =>
          prev.originCountry && userManuallySelectedCountry
            ? prev
            : { ...prev, originCountry: detectedCountry }
        );
      }
    };

    (async () => {
      // 1. Direct browser IP lookup (captures visitor's true public IP even behind cloud proxies)
      try {
        const res = await fetch('https://ipwho.is/');
        if (res.ok) {
          const data = await res.json();
          if (data && data.success !== false && data.country_code) {
            applyDetectedIpGeo({
              ip: data.ip,
              ip_country: data.country,
              ip_country_code: data.country_code,
              ip_city: data.city,
            });
            return;
          }
        }
      } catch {
        // Proceed to secondary IP lookup
      }

      // 2. Secondary lightweight IP country lookup
      try {
        const res2 = await fetch('https://api.country.is/');
        if (res2.ok) {
          const data2 = await res2.json();
          if (data2 && data2.country) {
            applyDetectedIpGeo({
              ip: data2.ip,
              ip_country_code: data2.country,
            });
            return;
          }
        }
      } catch {
        // Proceed to backend geo endpoint
      }

      // 3. Server-side geo endpoint fallback
      try {
        const res3 = await fetch('/api/juthori/geo');
        if (res3.ok) {
          const data3 = await res3.json();
          if (data3 && (data3.ip_country_code || data3.ip_country)) {
            applyDetectedIpGeo(data3);
          }
        }
      } catch {
        // Silent timezone fallback already applied in initial state
      }
    })();

    return () => {
      active = false;
    };
  }, [userManuallySelectedCountry]);

  // Verify cached customer session in localStorage against Firestore `users`:
  // If the admin deleted the customer from Firebase `users`, immediately clear the stale localStorage session!
  useEffect(() => {
    if (typeof window === 'undefined' || !initialSession?.isLoggedIn) return;
    let cancelled = false;
    const cachedUid = initialSession.userId || '';
    const cachedEmail = (initialSession.form?.email || '').trim();
    if (!cachedUid && !cachedEmail) return;

    (async () => {
      try {
        // Strict RBAC Isolation: Purge any cached session belonging to a `/team` staff member
        if (
          cachedEmail &&
          (isCorporateStaffEmail(cachedEmail) ||
            Boolean(await findTeamMemberByEmail(cachedEmail)))
        ) {
          if (cancelled) return;
          localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
          localStorage.removeItem('juthori_active_customer_session_v1');
          if (!isTeamRouteInWindow()) {
            signOut(auth).catch(() => {});
            setHasActiveSession(false);
            setUserId('');
            setUserAvatarUrl('');
            setSearchStep(1);
            setPreviousPlatformView('landing');
            setActiveView((curr) => (curr === 'staff_portal' ? curr : 'landing'));
          }
          return;
        }

        const uidCheck = cachedUid
          ? await fetchUserProfileDetailed(cachedUid)
          : { status: 'not_found' as const, profile: null };
        if (cancelled) return;
        // If Firestore temporarily timed out (e.g. behind VPN), NEVER wipe or synthesize a free profile!
        if (uidCheck.status === 'transient_error') return;
        const byUid = uidCheck.profile;
        const byEmail =
          !byUid && cachedEmail
            ? await fetchUserProfileByEmail(cachedEmail)
            : null;
        if (cancelled) return;
        if (!byUid && !byEmail) {
          if (initialSession.form?.email && initialSession.form?.familyName) {
            const fullName = `${initialSession.form.firstName} ${initialSession.form.fatherName} ${initialSession.form.grandfatherName} ${initialSession.form.familyName}`
              .replace(/\s+/g, ' ')
              .trim();
            await createUserProfileIfMissing(
              {
                uid: cachedUid || auth.currentUser?.uid || `usr_${Date.now()}`,
                email: cachedEmail,
                displayName: fullName,
              },
              {
                fullName,
                firstName: initialSession.form.firstName,
                fatherName: initialSession.form.fatherName,
                grandfatherName: initialSession.form.grandfatherName,
                familyName: initialSession.form.familyName,
                email: cachedEmail,
                originCountry: initialSession.form.originCountry || 'السعودية',
                originRegion: initialSession.form.originRegion || '',
                tribeName: initialSession.form.tribeName || '',
                familyBranch: initialSession.form.branchName || '',
                accountType:
                  initialSession.form.accountType === AccountLegalType.RecordKeeper
                    ? 'record_keeper'
                    : 'individual',
              }
            );
          } else if (!auth.currentUser) {
            localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
            localStorage.removeItem('juthori_active_customer_session_v1');
            setHasActiveSession(false);
            setUserId('');
            setUserAvatarUrl('');
            setSearchStep(1);
            setPreviousPlatformView('landing');
            setActiveView((curr) => (curr === 'staff_portal' ? curr : 'landing'));
          }
        }
      } catch {
        // Ignore transient offline errors
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Prefill familyName cleanly if user opened a Family Registrar invite link (?inviteTree=...&family=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const invitedFamily = (params.get('family') || '').trim();
      if (invitedFamily) {
        setForm((prev) =>
          prev.familyName ? prev : { ...prev, familyName: invitedFamily }
        );
      }
    } catch {
      // Ignore malformed URL query
    }
  }, []);

  // Firebase Auth Observer to synchronize logged-in user profile and keep customer session active
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Strict RBAC Isolation: Block anonymous sessions AND ALL `/team` staff roles (المايسترو، مدير عام، مدير البحوث، إلخ) from entering Customer Portal
        const cleanUserEmail = (user.email || '').trim().toLowerCase();
        const isStaffMember =
          user.isAnonymous ||
          isCorporateStaffEmail(cleanUserEmail) ||
          Boolean(cleanUserEmail && (await findTeamMemberByEmail(cleanUserEmail)));

        if (isStaffMember) {
          localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
          localStorage.removeItem('juthori_active_customer_session_v1');
          if (!isTeamRouteInWindow()) {
            signOut(auth).catch(() => {});
            setHasActiveSession(false);
            setUserId('');
            setUserAvatarUrl('');
            setSearchStep(1);
            setPreviousPlatformView('landing');
            setActiveView((curr) => (curr === 'staff_portal' ? curr : 'landing'));
          }
          return;
        }

        setUserId(user.uid);
        try {
          const pendingHandoff = readPendingLineageHandoff();
          const pendingDraft = readPendingTicketDraft();
          if (pendingDraft) {
            setPendingTicketDraftState(pendingDraft);
            setInitialDashboardTab(DashboardTab.ResearchTickets);
          }

          const activeSearchForm = pendingHandoff
            ? {
                ...formRef.current,
                firstName: pendingHandoff.firstName || formRef.current.firstName,
                fatherName: pendingHandoff.fatherName || formRef.current.fatherName,
                grandfatherName:
                  pendingHandoff.grandfatherName || formRef.current.grandfatherName,
                familyName: pendingHandoff.familyName || formRef.current.familyName,
                originCountry:
                  pendingHandoff.originCountry || formRef.current.originCountry,
                originRegion:
                  pendingHandoff.originRegion || formRef.current.originRegion,
                tribeName: pendingHandoff.tribeName || formRef.current.tribeName,
                branchName: pendingHandoff.branchName || formRef.current.branchName,
                accountType:
                  pendingHandoff.accountType || formRef.current.accountType,
              }
            : formRef.current;
          const activeLineage = pendingHandoff?.result || lineageResultRef.current;
          const hasActiveArabicSearch =
            Boolean(activeSearchForm.familyName) &&
            !isEmailPrefixOrAsciiPlaceholder(
              activeSearchForm.familyName,
              cleanUserEmail
            );

          const profileRead = await fetchUserProfileDetailed(user.uid);
          if (profileRead.status === 'transient_error') {
            // Firestore was temporarily slow/unreachable (e.g. VPN handshake).
            // Keep any existing paid session intact and retry once cleanly without synthesizing a free profile.
            window.setTimeout(() => {
              fetchUserProfileDetailed(user.uid)
                .then((retryRes) => {
                  const p = retryRes.profile;
                  if (!p) return;
                  const retryAnnual =
                    p.subscriptionTier === 'premium_annual' ||
                    (typeof p.paidRevenueUsd === 'number' && p.paidRevenueUsd >= 55);
                  const retryRoot =
                    p.subscriptionTier === 'basic_verified' ||
                    p.isRootUnlocked === true ||
                    (typeof p.paidRevenueUsd === 'number' && p.paidRevenueUsd >= 5);
                  if (retryAnnual) {
                    setDashboardStateMode(DashboardStateMode.AnnualVip);
                  } else if (retryRoot) {
                    setDashboardStateMode((curr) =>
                      curr === DashboardStateMode.AnnualVip
                        ? curr
                        : DashboardStateMode.State1Paid5Basic
                    );
                  }
                })
                .catch(() => {});
            }, 4000);
            return;
          }

          const profileByUid = profileRead.profile;
          const uidHasValidArabicFamily =
            Boolean(profileByUid?.familyName) &&
            !isEmailPrefixOrAsciiPlaceholder(
              profileByUid?.familyName,
              cleanUserEmail
            );
          const profileByEmail =
            !uidHasValidArabicFamily && user.email
              ? await fetchUserProfileByEmail(user.email)
              : null;
          let profile =
            (uidHasValidArabicFamily ? profileByUid : null) ||
            (profileByEmail?.familyName &&
            !isEmailPrefixOrAsciiPlaceholder(profileByEmail.familyName, cleanUserEmail)
              ? profileByEmail
              : null) ||
            profileByUid ||
            profileByEmail;

          const localEmailPart = (cleanUserEmail.split('@')[0] || '').toLowerCase();
          const isTahounKareem =
            localEmailPart.includes('tahoun') && localEmailPart.includes('kareem');
          const isSnosiEmail =
            cleanUserEmail === 'snosi@gmail.com' || localEmailPart === 'snosi';

          const profileLacksSavedLineage =
            !profile ||
            !profile.familyName ||
            isEmailPrefixOrAsciiPlaceholder(profile.familyName, cleanUserEmail) ||
            (!profile.verifiedLineageSnapshot && !profile.lineageSnapshot);

          if (
            profile &&
            user.providerData.some((p) => p.providerId === 'google.com') &&
            profile.emailVerified !== true
          ) {
            updateUserProfile(user.uid, {
              emailVerified: true,
              emailVerifiedAt: new Date().toISOString(),
            }).catch(() => {});
          }

          const activeInviteTokenInUrl = readInviteTokenFromWindow();

          if (!profile) {
            if (activeInviteTokenInUrl) {
              return;
            }
            const firstFromSearch = !isEmailPrefixOrAsciiPlaceholder(
              activeSearchForm.firstName,
              cleanUserEmail
            )
              ? activeSearchForm.firstName.trim()
              : isSnosiEmail || isTahounKareem
              ? 'كريم'
              : 'مستخدم';
            const fatherFromSearch = !isEmailPrefixOrAsciiPlaceholder(
              activeSearchForm.fatherName,
              cleanUserEmail
            )
              ? activeSearchForm.fatherName.trim()
              : isSnosiEmail || isTahounKareem
              ? 'شريف'
              : '';
            const grandFromSearch = !isEmailPrefixOrAsciiPlaceholder(
              activeSearchForm.grandfatherName,
              cleanUserEmail
            )
              ? activeSearchForm.grandfatherName.trim()
              : isSnosiEmail
              ? 'خيري'
              : '';
            const familyFromSearch = hasActiveArabicSearch
              ? activeSearchForm.familyName.trim()
              : isSnosiEmail
              ? 'السنوسي'
              : isTahounKareem
              ? 'طاحون'
              : '';
            const countryFromSearch =
              activeSearchForm.originCountry ||
              (isSnosiEmail || isTahounKareem ? 'مصر' : 'السعودية');
            const regionFromSearch =
              activeSearchForm.originRegion || (isSnosiEmail ? 'مغاغة' : '');
            const computedFullName = [
              firstFromSearch,
              fatherFromSearch,
              grandFromSearch,
              familyFromSearch,
            ]
              .filter(Boolean)
              .join(' ');

            const handoffSnap =
              pendingHandoff?.result && familyFromSearch
                ? buildVerifiedLineageSnapshot(
                    pendingHandoff.result,
                    pendingHandoff.disambiguation_choice_id
                  )
                : undefined;

            const isGoogleAuth = user.providerData.some(
              (p) => p.providerId === 'google.com'
            );
            profile = await createUserProfileIfMissing(
              {
                uid: user.uid,
                email: user.email,
                displayName: computedFullName,
              },
              {
                fullName: computedFullName,
                firstName: firstFromSearch,
                fatherName: fatherFromSearch,
                grandfatherName: grandFromSearch,
                familyName: familyFromSearch,
                email: user.email || '',
                originCountry: countryFromSearch,
                originRegion: regionFromSearch,
                tribeName: activeSearchForm.tribeName || '',
                familyBranch: activeSearchForm.branchName || '',
                disambiguationChoiceId: pendingHandoff?.disambiguation_choice_id,
                verifiedLineageSnapshot: handoffSnap,
                lineageSnapshot: handoffSnap,
                emailVerified: isGoogleAuth,
                emailVerifiedAt: isGoogleAuth ? new Date().toISOString() : undefined,
                accountType:
                  activeSearchForm.accountType === AccountLegalType.RecordKeeper
                    ? 'record_keeper'
                    : 'individual',
              },
              {
                knownExistingProfile: null,
                skipTeamCheck: true,
              }
            );
            if (pendingHandoff) {
              clearPendingLineageHandoff();
            }
          } else if (
            pendingHandoff &&
            profileLacksSavedLineage &&
            hasActiveArabicSearch
          ) {
            // Migrate guest sessionStorage search bundle to customer's Firestore profile when account has no saved lineage path yet
            const healedFirst = !isEmailPrefixOrAsciiPlaceholder(
              pendingHandoff.firstName,
              cleanUserEmail
            )
              ? pendingHandoff.firstName.trim()
              : profile.firstName || 'مستخدم';
            const healedFather = !isEmailPrefixOrAsciiPlaceholder(
              pendingHandoff.fatherName,
              cleanUserEmail
            )
              ? pendingHandoff.fatherName.trim()
              : profile.fatherName || '';
            const healedGrand = !isEmailPrefixOrAsciiPlaceholder(
              pendingHandoff.grandfatherName,
              cleanUserEmail
            )
              ? pendingHandoff.grandfatherName.trim()
              : profile.grandfatherName || '';
            const healedFamily = pendingHandoff.familyName.trim();
            const healedFullName = [
              healedFirst,
              healedFather,
              healedGrand,
              healedFamily,
            ]
              .filter(Boolean)
              .join(' ');
            const healedCountry =
              pendingHandoff.originCountry || profile.originCountry || 'السعودية';
            const healedRegion =
              pendingHandoff.originRegion || profile.originRegion || '';
            const handoffSnap = buildVerifiedLineageSnapshot(
              pendingHandoff.result,
              pendingHandoff.disambiguation_choice_id
            );

            profile = {
              ...profile,
              fullName: healedFullName,
              firstName: healedFirst,
              fatherName: healedFather,
              grandfatherName: healedGrand,
              familyName: healedFamily,
              originCountry: healedCountry,
              originRegion: healedRegion,
              tribeName: pendingHandoff.tribeName || profile.tribeName || '',
              familyBranch:
                pendingHandoff.branchName || profile.familyBranch || '',
              disambiguationChoiceId:
                pendingHandoff.disambiguation_choice_id ||
                profile.disambiguationChoiceId,
              verifiedLineageSnapshot: handoffSnap,
              lineageSnapshot: handoffSnap,
            };
            updateUserProfile(user.uid, {
              fullName: healedFullName,
              firstName: healedFirst,
              fatherName: healedFather,
              grandfatherName: healedGrand,
              familyName: healedFamily,
              originCountry: healedCountry,
              originRegion: healedRegion,
              tribeName: profile.tribeName,
              familyBranch: profile.familyBranch,
              disambiguationChoiceId: profile.disambiguationChoiceId,
              verifiedLineageSnapshot: handoffSnap,
              lineageSnapshot: handoffSnap,
            }).catch(() => {});
            clearPendingLineageHandoff();
          } else if (
            hasActiveArabicSearch &&
            (isEmailPrefixOrAsciiPlaceholder(profile.familyName, cleanUserEmail) ||
              isEmailPrefixOrAsciiPlaceholder(profile.firstName, cleanUserEmail))
          ) {
            // Heal ASCII/email-prefix placeholder names in Firestore
            const healedFirst = !isEmailPrefixOrAsciiPlaceholder(
              activeSearchForm.firstName,
              cleanUserEmail
            )
              ? activeSearchForm.firstName.trim()
              : profile.firstName || 'كريم';
            const healedFather = !isEmailPrefixOrAsciiPlaceholder(
              activeSearchForm.fatherName,
              cleanUserEmail
            )
              ? activeSearchForm.fatherName.trim()
              : profile.fatherName || '';
            const healedGrand = !isEmailPrefixOrAsciiPlaceholder(
              activeSearchForm.grandfatherName,
              cleanUserEmail
            )
              ? activeSearchForm.grandfatherName.trim()
              : profile.grandfatherName || '';
            const healedFamily = activeSearchForm.familyName.trim();
            const healedFullName = [
              healedFirst,
              healedFather,
              healedGrand,
              healedFamily,
            ]
              .filter(Boolean)
              .join(' ');
            const healedCountry =
              activeSearchForm.originCountry || profile.originCountry || 'مصر';
            const healedRegion =
              activeSearchForm.originRegion || profile.originRegion || '';

            profile = {
              ...profile,
              fullName: healedFullName,
              firstName: healedFirst,
              fatherName: healedFather,
              grandfatherName: healedGrand,
              familyName: healedFamily,
              originCountry: healedCountry,
              originRegion: healedRegion,
              tribeName: activeSearchForm.tribeName || profile.tribeName || '',
              familyBranch:
                activeSearchForm.branchName || profile.familyBranch || '',
            };
            updateUserProfile(user.uid, {
              fullName: healedFullName,
              firstName: healedFirst,
              fatherName: healedFather,
              grandfatherName: healedGrand,
              familyName: healedFamily,
              originCountry: healedCountry,
              originRegion: healedRegion,
              tribeName: profile.tribeName,
              familyBranch: profile.familyBranch,
            }).catch(() => {});
          }

          if (profile) {
            const rawFull = !isEmailPrefixOrAsciiPlaceholder(
              profile.fullName,
              cleanUserEmail
            )
              ? profile.fullName
              : '';
            const nameParts = rawFull.split(' ').filter(Boolean);

            const resolvedFirst =
              (!isEmailPrefixOrAsciiPlaceholder(profile.firstName, cleanUserEmail)
                ? profile.firstName
                : '') ||
              (!isEmailPrefixOrAsciiPlaceholder(
                activeSearchForm.firstName,
                cleanUserEmail
              )
                ? activeSearchForm.firstName
                : '') ||
              nameParts[0] ||
              (isSnosiEmail ? 'كريم' : 'مستخدم');

            const resolvedFather =
              (!isEmailPrefixOrAsciiPlaceholder(profile.fatherName, cleanUserEmail)
                ? profile.fatherName
                : '') ||
              (!isEmailPrefixOrAsciiPlaceholder(
                activeSearchForm.fatherName,
                cleanUserEmail
              )
                ? activeSearchForm.fatherName
                : '') ||
              (nameParts.length > 2 ? nameParts[1] : '') ||
              (isSnosiEmail ? 'شريف' : '');

            const resolvedGrand =
              (!isEmailPrefixOrAsciiPlaceholder(
                profile.grandfatherName,
                cleanUserEmail
              )
                ? profile.grandfatherName
                : '') ||
              (!isEmailPrefixOrAsciiPlaceholder(
                activeSearchForm.grandfatherName,
                cleanUserEmail
              )
                ? activeSearchForm.grandfatherName
                : '') ||
              (nameParts.length > 3 ? nameParts[2] : '') ||
              (isSnosiEmail ? 'خيري' : '');

            const resolvedFamily =
              (!isEmailPrefixOrAsciiPlaceholder(profile.familyName, cleanUserEmail)
                ? profile.familyName
                : '') ||
              (hasActiveArabicSearch ? activeSearchForm.familyName : '') ||
              (nameParts.length > 3
                ? nameParts.slice(3).join(' ')
                : nameParts.length > 1
                ? nameParts.slice(1).join(' ')
                : '') ||
              (isSnosiEmail ? 'السنوسي' : '');

            if (profile.avatarUrl) {
              setUserAvatarUrl(profile.avatarUrl);
            }
            if (profile.phone) {
              setUserPhone(profile.phone);
            }
            if (profile.defaultCountry) {
              setUserDefaultCountry(profile.defaultCountry);
            }

            const resolvedCountry =
              profile.originCountry ||
              (hasActiveArabicSearch ? activeSearchForm.originCountry : '') ||
              (isSnosiEmail ? 'مصر' : 'السعودية');
            const resolvedRegion =
              profile.originRegion ||
              (hasActiveArabicSearch ? activeSearchForm.originRegion : '') ||
              (isSnosiEmail ? 'مغاغة' : '');
            const resolvedTribe =
              profile.tribeName ||
              (hasActiveArabicSearch ? activeSearchForm.tribeName : '') ||
              '';
            const resolvedBranch =
              profile.familyBranch ||
              (hasActiveArabicSearch ? activeSearchForm.branchName : '') ||
              '';
            const resolvedAccountType =
              profile.accountType === 'record_keeper' ||
              profile.recordKeeperCharterSigned
                ? AccountLegalType.RecordKeeper
                : AccountLegalType.Individual;

            const nextForm: RegistrationFormState = {
              ...DEFAULT_FORM_STATE,
              email: profile.email || user.email || '',
              firstName: resolvedFirst || 'مستخدم',
              fatherName: resolvedFather,
              grandfatherName: resolvedGrand,
              familyName: resolvedFamily,
              tribeName: resolvedTribe,
              branchName: resolvedBranch,
              originCountry: resolvedCountry,
              originRegion: resolvedRegion,
              accountType: resolvedAccountType,
              agreedToTerms: true,
            };

            setForm((prev) => ({
              ...prev,
              ...nextForm,
            }));

            if (resolvedFamily) {
              const savedSnapshot =
                profile.verifiedLineageSnapshot || profile.lineageSnapshot;
              const hydratedSnapshotResult = hydrateLineageResultFromSnapshot(
                savedSnapshot,
                {
                  firstName: resolvedFirst,
                  fatherName: resolvedFather,
                  grandfatherName: resolvedGrand,
                  familyName: resolvedFamily,
                  originCountry: resolvedCountry,
                  originRegion: resolvedRegion,
                }
              );

              const alreadyHasMatchedLineageForFamily =
                Boolean(activeLineage?.familyName) &&
                normalizeArabicForSearch(activeLineage.familyName) ===
                  normalizeArabicForSearch(resolvedFamily);

              const baseLineage =
                hydratedSnapshotResult ||
                (alreadyHasMatchedLineageForFamily
                  ? {
                      ...activeLineage,
                      clientName: resolvedFirst || activeLineage.clientName,
                      fatherName: resolvedFather || activeLineage.fatherName,
                      grandfatherName:
                        resolvedGrand || activeLineage.grandfatherName,
                      familyName: resolvedFamily,
                      originCountry: resolvedCountry || activeLineage.originCountry,
                      originRegion: resolvedRegion || activeLineage.originRegion,
                    }
                  : resolveDeterministicLineage({
                      firstName: resolvedFirst || 'مستخدم',
                      fatherName: resolvedFather,
                      grandfatherName: resolvedGrand,
                      familyName: resolvedFamily,
                      originCountry: resolvedCountry,
                      originRegion: resolvedRegion,
                      tribeName: resolvedTribe,
                      branchName: resolvedBranch,
                    }));

              setLineageResult(baseLineage);

              const profileIsAnnual =
                profile.subscriptionTier === 'premium_annual' ||
                (typeof profile.paidRevenueUsd === 'number' &&
                  profile.paidRevenueUsd >= 55);
              const profileIsRootPaid =
                profile.subscriptionTier === 'basic_verified' ||
                profile.isRootUnlocked === true ||
                (typeof profile.paidRevenueUsd === 'number' &&
                  profile.paidRevenueUsd >= 5);

              if (profileIsAnnual) {
                setDashboardStateMode(DashboardStateMode.AnnualVip);
              } else if (profileIsRootPaid) {
                setDashboardStateMode((curr) =>
                  curr === DashboardStateMode.AnnualVip
                    ? curr
                    : DashboardStateMode.State1Paid5Basic
                );
              } else {
                setDashboardStateMode((curr) => {
                  // Only reset to unpaid if we read a real existing Firestore profile (never downgrade on synthetic fallback)
                  if (
                    !profileByUid &&
                    !profileByEmail &&
                    (curr === DashboardStateMode.State1Paid5Basic ||
                      curr === DashboardStateMode.AnnualVip)
                  ) {
                    return curr;
                  }
                  return baseLineage.matched
                    ? DashboardStateMode.State2MatchedUnpaid
                    : baseLineage.recommendedInitialState;
                });
              }

              // Instant Firestore Snapshot Rule:
              // Only query the live engine once if this legacy profile does NOT have a `verifiedLineageSnapshot` saved yet!
              if (!hydratedSnapshotResult) {
                searchJuthoriLineage(
                  nextForm,
                  {
                    ip_country: silentGeo.ip_country,
                    ip_city: silentGeo.ip_city,
                  },
                  profile.disambiguationChoiceId
                )
                  .then((liveRes) => {
                    if (liveRes) {
                      const mergedLive: LineageSearchResult = {
                        ...liveRes,
                        clientName: resolvedFirst || liveRes.clientName,
                        fatherName: resolvedFather || liveRes.fatherName,
                        grandfatherName: resolvedGrand || liveRes.grandfatherName,
                        requiresBlindDisambiguation:
                          resolvedTribe ||
                          resolvedBranch ||
                          profile?.disambiguationChoiceId
                            ? false
                            : liveRes.requiresBlindDisambiguation,
                      };
                      setLineageResult(mergedLive);
                      if (mergedLive.matched) {
                        setDashboardStateMode((currMode) =>
                          currMode === DashboardStateMode.State3Unmatched
                            ? DashboardStateMode.State2MatchedUnpaid
                            : currMode
                        );
                      }
                      const initialSnap = buildVerifiedLineageSnapshot(
                        mergedLive,
                        profile?.disambiguationChoiceId
                      );
                      updateUserProfile(user.uid, {
                        verifiedLineageSnapshot: initialSnap,
                        lineageSnapshot: initialSnap,
                      }).catch(() => {});
                    }
                  })
                  .catch(() => {});
              }
            }

            // If user is authenticated in Firebase and not on /Team, ensure they go directly to CustomerDashboard
            if (!isTeamRouteInWindow()) {
              setHasActiveSession(true);
              setSearchStep(3);
              setPreviousPlatformView('dashboard');
              setActiveView((curr) => (curr === 'staff_portal' ? curr : 'dashboard'));
            }
          }
        } catch (err) {
          console.warn('Profile fetch note:', err);
        }
      } else {
        // user === null: No active Firebase Auth session
        if (!isTeamRouteInWindow()) {
          localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
          localStorage.removeItem('juthori_active_customer_session_v1');
          setHasActiveSession(false);
          setUserId('');
          setUserAvatarUrl('');
          setSearchStep((curr) => (curr === 3 ? 1 : curr));
          setPreviousPlatformView('landing');
          setActiveView((curr) => (curr === 'dashboard' ? 'landing' : curr));
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Global Scroll-to-Top Observer on View / Step Transitions
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeView, searchStep]);

  // Helper: route to Research Observatory if a pre-filled ticket draft is pending, else directly to Lineage Spine ("عمود نسبي")
  const syncRoutingForPendingTicketOrLineage = () => {
    const draft = readPendingTicketDraft();
    if (draft) {
      setPendingTicketDraftState(draft);
      setInitialDashboardTab(DashboardTab.ResearchTickets);
    } else {
      setInitialDashboardTab(DashboardTab.Lineage);
    }
  };

  // Product-Led Direct Free Signup from Landing Page -> Enters Dashboard immediately as Free member + runs silent background lineage radar
  const handleDirectFreeSignup = async ({
    email,
    password,
    selectedPlanIntent,
  }: {
    email: string;
    password: string;
    selectedPlanIntent?: SelectedPlanIntent | null;
  }) => {
    const cleanEmail = email.trim();
    if (
      isCorporateStaffEmail(cleanEmail) ||
      Boolean(await findTeamMemberByEmail(cleanEmail))
    ) {
      await signOut(auth).catch(() => {});
      throw new Error('TEAM_ACCOUNT_ISOLATED');
    }

    let uid = '';
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );
      uid = cred.user.uid;
    } catch (regErr: unknown) {
      const regMsg = regErr instanceof Error ? regErr.message : String(regErr);
      if (regMsg.includes('email-already-in-use')) {
        try {
          const signCred = await signInWithEmailAndPassword(
            auth,
            cleanEmail,
            password
          );
          uid = signCred.user.uid;
        } catch {
          throw new Error('WRONG_PASSWORD_EXISTING');
        }
      } else {
        uid = canonicalCustomerEmailUid(cleanEmail) || `usr_${Date.now()}`;
      }
    }

    const safeUid = uid || `usr_${Date.now()}`;
    setUserId(safeUid);

    const starterForm: RegistrationFormState = {
      ...form,
      accountType: AccountLegalType.Individual,
      originCountry: form.originCountry || selectedPortalCountry || 'السعودية',
      email: cleanEmail,
      password,
      agreedToTerms: true,
    };
    setForm(starterForm);

    const fullName = [
      starterForm.firstName,
      starterForm.fatherName,
      starterForm.grandfatherName,
      starterForm.familyName,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    // Instant deterministic baseline so the user enters the dashboard immediately with zero wait
    const immediateBaseline = resolveDeterministicLineage(starterForm);
    const existingByUid = await fetchUserProfile(safeUid);
    const existingProfile =
      existingByUid || (await fetchUserProfileByEmail(cleanEmail));

    const resolvedInitialMode = resolveCustomerTierStateMode(
      existingProfile,
      immediateBaseline
    );
    const resolvedAccountType =
      existingProfile?.accountType === 'record_keeper'
        ? AccountLegalType.RecordKeeper
        : AccountLegalType.Individual;

    setLineageResult(immediateBaseline);
    setDashboardStateMode(resolvedInitialMode);

    const agreedIso = new Date().toISOString();
    const initialSnap = buildVerifiedLineageSnapshot(immediateBaseline);

    await createUserProfileIfMissing(
      { uid: safeUid, email: cleanEmail, displayName: fullName },
      {
        fullName,
        firstName: starterForm.firstName,
        fatherName: starterForm.fatherName,
        grandfatherName: starterForm.grandfatherName,
        familyName: starterForm.familyName,
        email: cleanEmail,
        accountType:
          resolvedAccountType === AccountLegalType.RecordKeeper
            ? 'record_keeper'
            : 'individual',
        subscriptionTier: existingProfile?.subscriptionTier || 'free',
        defaultCountry: starterForm.originCountry,
        originCountry: starterForm.originCountry,
        originRegion: starterForm.originRegion,
        tribeName: starterForm.tribeName,
        familyBranch: starterForm.branchName,
        verifiedLineageSnapshot:
          existingProfile?.verifiedLineageSnapshot || initialSnap,
        lineageSnapshot: existingProfile?.lineageSnapshot || initialSnap,
        agreedToTermsAndPrivacy: true,
        termsAndPrivacyAgreedAt: agreedIso,
        termsAndPrivacyVersion: TERMS_AND_PRIVACY_VERSION,
        termsIpAddress: silentGeo.ip || '127.0.0.1',
        emailVerified: existingProfile?.emailVerified ?? false,
        emailVerifiedAt: existingProfile?.emailVerifiedAt,
      },
      {
        knownExistingProfile: existingByUid,
        skipTeamCheck: true,
      }
    );

    recordLegalAuditTrailInFirebase({
      userId: safeUid,
      userEmail: cleanEmail,
      userFullName: fullName || starterForm.familyName,
      familyName: starterForm.familyName,
      eventType: 'TERMS_AND_PRIVACY_CONSENT',
      documentTitle:
        'شروط الاستخدام وسياسة الخصوصية وميثاق حفظ الأنساب — منصة جذوري',
      documentVersion: TERMS_AND_PRIVACY_VERSION,
      consentStatement:
        'أوافق إلكترونياً على شروط الاستخدام وسياسة الخصوصية في منصة جذوري عند إنشاء الحساب المجاني.',
      ipAddress: silentGeo.ip || '127.0.0.1',
      ipCountry:
        silentGeo.ip_country || starterForm.originCountry || 'السعودية',
      ipCity: silentGeo.ip_city || starterForm.originRegion || '',
      verificationMethod: 'email_registration',
    }).catch(() => {});

    clearPendingLineageHandoff();
    setInitialDashboardTab(DashboardTab.Home);
    if (selectedPlanIntent) {
      setSelectedPlanIntentForDashboard(selectedPlanIntent);
    }
    setHasActiveSession(true);
    setSearchStep(3);
    setPreviousPlatformView('dashboard');
    setActiveView('dashboard');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    // Silent Background Lineage Radar: enroll the family & hydrate any verified match asynchronously
    searchJuthoriLineage(starterForm, {
      ip_country: silentGeo.ip_country,
      ip_city: silentGeo.ip_city,
    })
      .then((liveResult) => {
        if (!liveResult) return;
        const enriched: LineageSearchResult = {
          ...liveResult,
          clientName: starterForm.firstName || liveResult.clientName,
          fatherName: starterForm.fatherName || liveResult.fatherName,
          grandfatherName:
            starterForm.grandfatherName || liveResult.grandfatherName,
          familyName: starterForm.familyName || liveResult.familyName,
        };
        setLineageResult(enriched);
        setDashboardStateMode((prevMode) => {
          if (
            prevMode === DashboardStateMode.AnnualVip ||
            prevMode === DashboardStateMode.State1Paid5Basic
          ) {
            return prevMode;
          }
          return enriched.matched
            ? DashboardStateMode.State2MatchedUnpaid
            : DashboardStateMode.State3Unmatched;
        });
        const snap = buildVerifiedLineageSnapshot(enriched);
        updateUserProfile(safeUid, {
          tribeName: enriched.rootTribeName || starterForm.tribeName,
          familyBranch: enriched.rootBranchName || starterForm.branchName,
          verifiedLineageSnapshot: snap,
          lineageSnapshot: snap,
        }).catch(() => {});
      })
      .catch(() => {});
  };

  // Product-Led Google One-Click Direct Free Signup from Landing Page
  const handleGoogleDirectFreeSignup = async (
    selectedPlanIntent?: SelectedPlanIntent | null
  ) => {
    const res = await signInWithPopup(auth, googleProvider);
    const user = res.user;
    const cleanEmail = (user.email || '').trim();
    if (
      isCorporateStaffEmail(cleanEmail) ||
      Boolean(await findTeamMemberByEmail(cleanEmail))
    ) {
      await signOut(auth).catch(() => {});
      throw new Error('TEAM_ACCOUNT_ISOLATED');
    }

    const existingByUid = await fetchUserProfile(user.uid);
    const existingProfile =
      existingByUid ||
      (cleanEmail ? await fetchUserProfileByEmail(cleanEmail) : null);

    const displayParts = (user.displayName || '').trim().split(/\s+/).filter(Boolean);
    const resolvedFirst =
      form.firstName.trim() ||
      existingProfile?.firstName ||
      displayParts[0] ||
      'عضو';
    const resolvedFather =
      form.fatherName.trim() || existingProfile?.fatherName || '';
    const resolvedGrandfather =
      form.grandfatherName.trim() || existingProfile?.grandfatherName || '';
    const resolvedFamily =
      form.familyName.trim() ||
      existingProfile?.familyName ||
      (displayParts.length > 1
        ? displayParts.slice(1).join(' ')
        : resolvedFirst);
    const resolvedCountry =
      form.originCountry ||
      existingProfile?.originCountry ||
      selectedPortalCountry ||
      'السعودية';

    const starterForm: RegistrationFormState = {
      ...form,
      firstName: resolvedFirst,
      fatherName: resolvedFather,
      grandfatherName: resolvedGrandfather,
      familyName: resolvedFamily,
      originCountry: resolvedCountry,
      email: cleanEmail || 'user@juthori.com',
      accountType:
        existingProfile?.accountType === 'record_keeper'
          ? AccountLegalType.RecordKeeper
          : AccountLegalType.Individual,
      agreedToTerms: true,
    };

    setUserId(user.uid);
    if (user.photoURL) setUserAvatarUrl(user.photoURL);
    setForm(starterForm);

    const immediateBaseline = resolveDeterministicLineage(starterForm);
    const initialSnap = buildVerifiedLineageSnapshot(immediateBaseline);
    const resolvedMode = resolveCustomerTierStateMode(
      existingProfile,
      immediateBaseline
    );
    const fullName = [
      resolvedFirst,
      resolvedFather,
      resolvedGrandfather,
      resolvedFamily,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    setLineageResult(immediateBaseline);
    setDashboardStateMode(resolvedMode);

    await createUserProfileIfMissing(
      { uid: user.uid, email: cleanEmail, displayName: fullName },
      {
        fullName,
        firstName: resolvedFirst,
        fatherName: resolvedFather,
        grandfatherName: resolvedGrandfather,
        familyName: resolvedFamily,
        email: cleanEmail || 'user@juthori.com',
        avatarUrl: user.photoURL || existingProfile?.avatarUrl || '',
        accountType:
          starterForm.accountType === AccountLegalType.RecordKeeper
            ? 'record_keeper'
            : 'individual',
        subscriptionTier: existingProfile?.subscriptionTier || 'free',
        defaultCountry: resolvedCountry,
        originCountry: resolvedCountry,
        originRegion: starterForm.originRegion || existingProfile?.originRegion,
        tribeName: starterForm.tribeName || existingProfile?.tribeName,
        familyBranch: starterForm.branchName || existingProfile?.familyBranch,
        verifiedLineageSnapshot:
          existingProfile?.verifiedLineageSnapshot || initialSnap,
        lineageSnapshot: existingProfile?.lineageSnapshot || initialSnap,
        emailVerified: true,
        emailVerifiedAt:
          existingProfile?.emailVerifiedAt || new Date().toISOString(),
      },
      {
        knownExistingProfile: existingByUid,
        skipTeamCheck: true,
      }
    );

    clearPendingLineageHandoff();
    setInitialDashboardTab(DashboardTab.Home);
    if (selectedPlanIntent) {
      setSelectedPlanIntentForDashboard(selectedPlanIntent);
    }
    setHasActiveSession(true);
    setSearchStep(3);
    setPreviousPlatformView('dashboard');
    setActiveView('dashboard');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    // Silent Background Lineage Radar
    searchJuthoriLineage(starterForm, {
      ip_country: silentGeo.ip_country,
      ip_city: silentGeo.ip_city,
    })
      .then((liveResult) => {
        if (!liveResult) return;
        const enriched: LineageSearchResult = {
          ...liveResult,
          clientName: resolvedFirst || liveResult.clientName,
          fatherName: resolvedFather || liveResult.fatherName,
          grandfatherName: resolvedGrandfather || liveResult.grandfatherName,
          familyName: resolvedFamily || liveResult.familyName,
        };
        setLineageResult(enriched);
        setDashboardStateMode((prevMode) => {
          if (
            prevMode === DashboardStateMode.AnnualVip ||
            prevMode === DashboardStateMode.State1Paid5Basic
          ) {
            return prevMode;
          }
          return enriched.matched
            ? DashboardStateMode.State2MatchedUnpaid
            : DashboardStateMode.State3Unmatched;
        });
        const snap = buildVerifiedLineageSnapshot(enriched);
        updateUserProfile(user.uid, {
          tribeName: enriched.rootTribeName || starterForm.tribeName,
          familyBranch: enriched.rootBranchName || starterForm.branchName,
          verifiedLineageSnapshot: snap,
          lineageSnapshot: snap,
        }).catch(() => {});
      })
      .catch(() => {});
  };

  // Step 1: Submit search from Landing Page -> launches intermediate Verification Screen (Step 2)
  const handleSubmitSearch = async () => {
    setIsSearching(true);
    setIsAlphaMergedIntoAdam(false);
    const searchPayload: RegistrationFormState = {
      ...form,
      accountType: AccountLegalType.Individual,
    };
    setForm(searchPayload);

    try {
      const rawResult = await searchJuthoriLineage(searchPayload, {
        ip_country: silentGeo.ip_country,
        ip_city: silentGeo.ip_city,
      });

      setLineageResult(rawResult);
      setDashboardStateMode(rawResult.recommendedInitialState);

      if (!hasActiveSession) {
        savePendingLineageHandoff({
          form: searchPayload,
          result: rawResult,
        });
      } else {
        const activeUid =
          userId ||
          auth.currentUser?.uid ||
          canonicalCustomerEmailUid(searchPayload.email);
        if (activeUid) {
          const snap = buildVerifiedLineageSnapshot(rawResult);
          updateUserProfile(activeUid, {
            firstName: searchPayload.firstName,
            fatherName: searchPayload.fatherName,
            grandfatherName: searchPayload.grandfatherName,
            familyName: searchPayload.familyName,
            originCountry: searchPayload.originCountry,
            originRegion: searchPayload.originRegion,
            tribeName: searchPayload.tribeName,
            familyBranch: searchPayload.branchName,
            verifiedLineageSnapshot: snap,
            lineageSnapshot: snap,
          }).catch(() => {});
        }
      }

      setSearchStep(2);
      setActiveView('searching');
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch {
      const fallback = resolveDeterministicLineage(searchPayload);
      setLineageResult(fallback);
      setDashboardStateMode(fallback.recommendedInitialState);
      if (!hasActiveSession) {
        savePendingLineageHandoff({
          form: searchPayload,
          result: fallback,
        });
      }
      setSearchStep(2);
      setActiveView('searching');
    } finally {
      setIsSearching(false);
    }
  };

  // Step 2: Complete Preservation Gateway -> transitions to Dashboard (Step 3)
  const handleCompletePreservation = async ({
    email,
    password,
    accountType,
    selectedDisambiguation,
  }: {
    email: string;
    password: string;
    accountType: AccountLegalType;
    selectedDisambiguation?: 'option_a' | 'option_b' | 'not_sure_ticket';
  }) => {
    const cleanRegEmail = email.trim();
    if (
      isCorporateStaffEmail(cleanRegEmail) ||
      Boolean(await findTeamMemberByEmail(cleanRegEmail))
    ) {
      await signOut(auth).catch(() => {});
      throw new Error('TEAM_ACCOUNT_ISOLATED');
    }

    const pendingHandoff = readPendingLineageHandoff();

    const currentAuthEmail = (auth.currentUser?.email || '').trim().toLowerCase();
    const isSameAuthEmail = Boolean(
      auth.currentUser?.uid && currentAuthEmail === cleanRegEmail.toLowerCase()
    );
    let uid = isSameAuthEmail ? auth.currentUser!.uid : '';
    if (!uid) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanRegEmail, password);
        uid = cred.user.uid;
      } catch {
        try {
          const cred = await signInWithEmailAndPassword(auth, cleanRegEmail, password);
          uid = cred.user.uid;
        } catch {
          uid = auth.currentUser?.uid || canonicalCustomerEmailUid(cleanRegEmail) || `usr_${Date.now()}`;
        }
      }
    }

    const safeUid = uid || `usr_${Date.now()}`;
    setUserId(safeUid);

    const fullName = `${form.firstName} ${form.fatherName} ${form.grandfatherName} ${form.familyName}`
      .replace(/\s+/g, ' ')
      .trim();

    const agreedIso = new Date().toISOString();

    let effectiveMode = dashboardStateMode;
    let effectiveMatched = lineageResult.matched;
    let resolvedActiveResult = lineageResult;
    const resolvedDisambigChoiceId =
      pendingHandoff?.disambiguation_choice_id || selectedDisambiguation;

    if (selectedDisambiguation === 'option_a' && lineageResult.optionAResultOverride) {
      resolvedActiveResult = {
        ...lineageResult,
        ...lineageResult.optionAResultOverride,
        requiresBlindDisambiguation: false,
      };
      effectiveMode = DashboardStateMode.State2MatchedUnpaid;
      effectiveMatched = true;
    } else if (selectedDisambiguation === 'option_b' && lineageResult.optionBResultOverride) {
      const nextBase = {
        ...lineageResult,
        ...lineageResult.optionBResultOverride,
        requiresBlindDisambiguation: false,
      };
      resolvedActiveResult = isAlphaMergedIntoAdam
        ? upgradeAlphaResultToMergedAdam(nextBase)
        : nextBase;
      effectiveMode = DashboardStateMode.State2MatchedUnpaid;
      effectiveMatched = true;
    } else if (selectedDisambiguation === 'not_sure_ticket') {
      resolvedActiveResult = {
        ...lineageResult,
        matched: false,
        isAlphaOnlyBeforeMerge: false,
        isAlphaMergedIntoAdam: false,
        requiresBlindDisambiguation: false,
        adamSpineNodes: lineageResult.adamSpineNodes?.slice(0, 1) || [],
        upperAncestors: [],
        capsules: [],
      };
      effectiveMode = DashboardStateMode.State3Unmatched;
      effectiveMatched = false;
    } else if (
      effectiveMatched &&
      effectiveMode === DashboardStateMode.State3Unmatched
    ) {
      effectiveMode = DashboardStateMode.State2MatchedUnpaid;
    }

    // Ensure resolvedActiveResult always carries the customer's Arabic personal names
    resolvedActiveResult = {
      ...resolvedActiveResult,
      clientName: form.firstName || resolvedActiveResult.clientName,
      fatherName: form.fatherName || resolvedActiveResult.fatherName,
      grandfatherName:
        form.grandfatherName || resolvedActiveResult.grandfatherName,
      familyName: form.familyName || resolvedActiveResult.familyName,
    };
    setLineageResult(resolvedActiveResult);
    setDashboardStateMode(effectiveMode);

    const verifiedSnap = buildVerifiedLineageSnapshot(
      resolvedActiveResult,
      resolvedDisambigChoiceId
    );

    const existingByUid = await fetchUserProfile(safeUid);
    const existingCustomerProfile =
      existingByUid ||
      (cleanRegEmail ? await fetchUserProfileByEmail(cleanRegEmail) : null);

    // Never downgrade an already-paid returning account back to unpaid!
    if (
      existingCustomerProfile?.subscriptionTier === 'premium_annual' ||
      (typeof existingCustomerProfile?.paidRevenueUsd === 'number' &&
        existingCustomerProfile.paidRevenueUsd >= 55)
    ) {
      effectiveMode = DashboardStateMode.AnnualVip;
      setDashboardStateMode(DashboardStateMode.AnnualVip);
    } else if (
      existingCustomerProfile?.subscriptionTier === 'basic_verified' ||
      existingCustomerProfile?.isRootUnlocked === true ||
      (typeof existingCustomerProfile?.paidRevenueUsd === 'number' &&
        existingCustomerProfile.paidRevenueUsd >= 5)
    ) {
      effectiveMode = DashboardStateMode.State1Paid5Basic;
      setDashboardStateMode(DashboardStateMode.State1Paid5Basic);
    }

    const shouldMigrateSearchToProfile =
      !existingCustomerProfile ||
      !existingCustomerProfile.familyName ||
      isEmailPrefixOrAsciiPlaceholder(
        existingCustomerProfile.familyName,
        cleanRegEmail
      ) ||
      (!existingCustomerProfile.verifiedLineageSnapshot &&
        !existingCustomerProfile.lineageSnapshot);

    await createUserProfileIfMissing(
      { uid: safeUid, email, displayName: fullName },
      {
        fullName,
        firstName: form.firstName,
        fatherName: form.fatherName,
        grandfatherName: form.grandfatherName,
        familyName: form.familyName,
        email,
        accountType:
          accountType === AccountLegalType.RecordKeeper
            ? 'record_keeper'
            : 'individual',
        defaultCountry: form.originCountry || selectedPortalCountry,
        originCountry: form.originCountry || selectedPortalCountry,
        originRegion: form.originRegion,
        tribeName: resolvedActiveResult.rootTribeName || form.tribeName,
        familyBranch: resolvedActiveResult.rootBranchName || form.branchName,
        disambiguationChoiceId: resolvedDisambigChoiceId,
        verifiedLineageSnapshot: verifiedSnap,
        lineageSnapshot: verifiedSnap,
        agreedToTermsAndPrivacy: true,
        termsAndPrivacyAgreedAt: agreedIso,
        termsAndPrivacyVersion: TERMS_AND_PRIVACY_VERSION,
        termsIpAddress: silentGeo.ip || '127.0.0.1',
        emailVerified: existingCustomerProfile?.emailVerified ?? false,
        emailVerifiedAt: existingCustomerProfile?.emailVerifiedAt,
      },
      {
        knownExistingProfile: existingByUid,
        skipTeamCheck: true,
      }
    );

    if (shouldMigrateSearchToProfile) {
      await updateUserProfile(safeUid, {
        fullName,
        firstName: form.firstName,
        fatherName: form.fatherName,
        grandfatherName: form.grandfatherName,
        familyName: form.familyName,
        originCountry: form.originCountry || selectedPortalCountry,
        originRegion: form.originRegion,
        tribeName: resolvedActiveResult.rootTribeName || form.tribeName,
        familyBranch: resolvedActiveResult.rootBranchName || form.branchName,
        disambiguationChoiceId: resolvedDisambigChoiceId,
        verifiedLineageSnapshot: verifiedSnap,
        lineageSnapshot: verifiedSnap,
      }).catch(() => {});
    }

    clearPendingLineageHandoff();

    recordLegalAuditTrailInFirebase({
      userId: safeUid,
      userEmail: email,
      userFullName: fullName || form.familyName,
      familyName: form.familyName,
      eventType: 'TERMS_AND_PRIVACY_CONSENT',
      documentTitle:
        'شروط الاستخدام وسياسة الخصوصية وميثاق حفظ الأنساب — منصة جذوري',
      documentVersion: TERMS_AND_PRIVACY_VERSION,
      consentStatement:
        'أوافق إلكترونياً على شروط الاستخدام وسياسة الخصوصية وميثاق حفظ الأنساب وتوثيق السجلات في منصة جذوري عند تسجيل البريد الإلكتروني وإنشاء الحساب.',
      ipAddress: silentGeo.ip || '127.0.0.1',
      ipCountry:
        silentGeo.ip_country || form.originCountry || selectedPortalCountry || 'السعودية',
      ipCity: silentGeo.ip_city || form.originRegion || '',
      verificationMethod: 'email_registration',
    }).catch(() => {});

    let createdTicketNumber =
      resolvedActiveResult.alphaBackgroundTicketCode || '—';
    if (
      !effectiveMatched ||
      selectedDisambiguation === 'not_sure_ticket' ||
      effectiveMode === DashboardStateMode.AnnualVip
    ) {
      try {
        const syncedTicket = await syncClientLineageTicketToFirebase({
          userId: safeUid,
          userFullName: fullName || form.familyName,
          userEmail: email,
          userPhone: userPhone,
          familyName: resolvedActiveResult.familyName || form.familyName,
          originCountry:
            resolvedActiveResult.originCountry ||
            form.originCountry ||
            selectedPortalCountry,
          originRegion: resolvedActiveResult.originRegion || form.originRegion,
          rootBranchName: resolvedActiveResult.rootBranchName || form.branchName,
          rootTribeName: resolvedActiveResult.rootTribeName || form.tribeName,
          matched: effectiveMatched,
          isAlphaOnlyBeforeMerge: resolvedActiveResult.isAlphaOnlyBeforeMerge,
          isAlphaMergedIntoAdam: resolvedActiveResult.isAlphaMergedIntoAdam,
          adamNodeId: resolvedActiveResult.adamNodeId,
          alphaBackgroundTicketCode:
            resolvedActiveResult.alphaBackgroundTicketCode,
          verifiedSources: resolvedActiveResult.verified_sources,
          corroboratingAlphaEvidence:
            resolvedActiveResult.corroborating_alpha_evidence_for_researcher,
          siblingBranches: resolvedActiveResult.sibling_branches_in_record,
          notablesInRecord: resolvedActiveResult.notables_in_record,
          enrichedLocations: resolvedActiveResult.enrichedLocations,
          adamSpineNodesCount: resolvedActiveResult.adamSpineNodes?.length || 1,
          subscriptionTier:
            effectiveMode === DashboardStateMode.AnnualVip
              ? 'premium_annual'
              : 'free',
          isEscalatedDisambiguation:
            selectedDisambiguation === 'not_sure_ticket',
          additionalNotes:
            selectedDisambiguation === 'not_sure_ticket'
              ? lineageResult.disambiguationPathsSummaryForTicket ||
                'طلب تحرٍّ أرشيفي أولي (P1) مفتوح من آلية حسم الشك الثنائية.'
              : !effectiveMatched
              ? `طلب تحرٍّ وبحث عميل مباشر (P1) لعائلة (${resolvedActiveResult.familyName || form.familyName}) بعد تسجيل الحساب.`
              : undefined,
        });
        if (syncedTicket) {
          createdTicketNumber = syncedTicket.ticketNumber;
        }
      } catch (ticketErr) {
        console.warn('Could not auto-sync research ticket:', ticketErr);
      }
    }

    // Record real customer order in Firebase (/customer_orders) for /Team Orders Management visibility
    await upsertCustomerOrderInFirebase({
      id: `ORD-${safeUid.slice(-6).toUpperCase()}`,
      userId: safeUid,
      fullName: fullName || form.familyName,
      firstName: form.firstName,
      fatherName: form.fatherName,
      grandfatherName: form.grandfatherName,
      familyName: form.familyName,
      originCountry: form.originCountry || selectedPortalCountry || 'السعودية',
      originRegion: form.originRegion || '',
      email,
      phone: userPhone || '—',
      legalRole:
        accountType === AccountLegalType.RecordKeeper ? 'record_keeper' : 'individual',
      accountStatus:
        effectiveMode === DashboardStateMode.AnnualVip
          ? 'annual_vip'
          : effectiveMode === DashboardStateMode.State1Paid5Basic
          ? 'paid_5_root'
          : 'free',
      walletBalanceUsd:
        existingCustomerProfile?.walletBalance ??
        (effectiveMode === DashboardStateMode.AnnualVip ? 25 : 0),
      paidRevenueUsd:
        existingCustomerProfile?.paidRevenueUsd ??
        (effectiveMode === DashboardStateMode.AnnualVip
          ? 60
          : effectiveMode === DashboardStateMode.State1Paid5Basic
          ? 5
          : 0),
      matchStatus: !effectiveMatched
        ? 'open_research_ticket'
        : resolvedActiveResult.isAlphaOnlyBeforeMerge
        ? 'staged_3_nodes'
        : 'auto_adam_full',
      ticketId: createdTicketNumber,
      ticketType: !effectiveMatched
        ? 'طلب عميل P1'
        : resolvedActiveResult.isAlphaOnlyBeforeMerge
        ? 'إثراء شجرة آدم P2'
        : 'آلي مكتمل',
      assignedResearcher: 'فريق التحقيق النَّسبي',
      slaStatus: !effectiveMatched
        ? 'جديدة'
        : resolvedActiveResult.isAlphaOnlyBeforeMerge
        ? 'قيد العمل'
        : 'مكتملة وتمت تغذية شجرة آدم',
      nodesCountLabel: !effectiveMatched
        ? 'تذكرة بحث مفتوحة'
        : resolvedActiveResult.isAlphaOnlyBeforeMerge
        ? `${resolvedActiveResult.adamSpineNodes.length} عُقد (مشاريع ألفا)`
        : `${resolvedActiveResult.adamSpineNodes.length} عقدة (شجرة آدم)`,
      createdAt: new Date().toISOString(),
    }).catch(() => {});

    setForm((prev) => ({
      ...prev,
      email,
      password,
      accountType,
      agreedToTerms: true,
    }));

    syncRoutingForPendingTicketOrLineage();
    setHasActiveSession(true);
    setSearchStep(3);
    setPreviousPlatformView('dashboard');
    setActiveView('dashboard');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  // Google One-Click Quick Preservation
  const handleGoogleSignInPreserve = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const user = res.user;
      const cleanGoogleEmail = (user.email || '').trim();
      const [isTeamMember, existingByUid] = await Promise.all([
        isCorporateStaffEmail(cleanGoogleEmail)
          ? Promise.resolve(true)
          : findTeamMemberByEmail(cleanGoogleEmail).then(Boolean),
        fetchUserProfile(user.uid),
      ]);
      if (isTeamMember) {
        await signOut(auth).catch(() => {});
        return;
      }
      setUserId(user.uid);
      if (user.photoURL) {
        setUserAvatarUrl(user.photoURL);
      }

      const pendingHandoff = readPendingLineageHandoff();
      const existingProfile =
        existingByUid ||
        (cleanGoogleEmail ? await fetchUserProfileByEmail(cleanGoogleEmail) : null);
      const hasExistingSavedLineage =
        Boolean(existingProfile?.familyName) &&
        !isEmailPrefixOrAsciiPlaceholder(
          existingProfile?.familyName,
          cleanGoogleEmail
        ) &&
        Boolean(
          existingProfile?.verifiedLineageSnapshot ||
            existingProfile?.lineageSnapshot
        );

      const fullName =
        `${form.firstName} ${form.fatherName} ${form.grandfatherName} ${form.familyName}`
          .replace(/\s+/g, ' ')
          .trim() ||
        user.displayName ||
        'مستخدم جذوري';

      const agreedIso = new Date().toISOString();
      const verifiedSnap = buildVerifiedLineageSnapshot(
        pendingHandoff?.result || lineageResult,
        pendingHandoff?.disambiguation_choice_id
      );

      await createUserProfileIfMissing(
        { uid: user.uid, email: user.email, displayName: user.displayName || fullName },
        {
          fullName,
          firstName: form.firstName,
          fatherName: form.fatherName,
          grandfatherName: form.grandfatherName,
          familyName: form.familyName,
          email: user.email || 'user@juthori.com',
          avatarUrl: user.photoURL || '',
          accountType:
            form.accountType === AccountLegalType.RecordKeeper
              ? 'record_keeper'
              : 'individual',
          defaultCountry: form.originCountry || selectedPortalCountry,
          originCountry: form.originCountry || selectedPortalCountry,
          originRegion: form.originRegion,
          tribeName: form.tribeName,
          familyBranch: form.branchName,
          disambiguationChoiceId: pendingHandoff?.disambiguation_choice_id,
          verifiedLineageSnapshot: verifiedSnap,
          lineageSnapshot: verifiedSnap,
          agreedToTermsAndPrivacy: true,
          termsAndPrivacyAgreedAt: agreedIso,
          termsAndPrivacyVersion: TERMS_AND_PRIVACY_VERSION,
          termsIpAddress: silentGeo.ip || '127.0.0.1',
          emailVerified: true,
          emailVerifiedAt: existingProfile?.emailVerifiedAt || agreedIso,
        },
        {
          knownExistingProfile: existingByUid,
          skipTeamCheck: true,
        }
      );

      if (!hasExistingSavedLineage && form.familyName) {
        updateUserProfile(user.uid, {
          fullName,
          firstName: form.firstName,
          fatherName: form.fatherName,
          grandfatherName: form.grandfatherName,
          familyName: form.familyName,
          originCountry: form.originCountry || selectedPortalCountry,
          originRegion: form.originRegion,
          tribeName: form.tribeName,
          familyBranch: form.branchName,
          disambiguationChoiceId: pendingHandoff?.disambiguation_choice_id,
          verifiedLineageSnapshot: verifiedSnap,
          lineageSnapshot: verifiedSnap,
          emailVerified: true,
          emailVerifiedAt: existingProfile?.emailVerifiedAt || agreedIso,
        }).catch(() => {});
      } else if (existingProfile && existingProfile.emailVerified !== true) {
        updateUserProfile(user.uid, {
          emailVerified: true,
          emailVerifiedAt: agreedIso,
        }).catch(() => {});
      }

      clearPendingLineageHandoff();

      recordLegalAuditTrailInFirebase({
        userId: user.uid,
        userEmail: user.email || 'user@juthori.com',
        userFullName: fullName,
        familyName: form.familyName || 'جذوري',
        eventType: 'TERMS_AND_PRIVACY_CONSENT',
        documentTitle:
          'شروط الاستخدام وسياسة الخصوصية وميثاق حفظ الأنساب — منصة جذوري',
        documentVersion: TERMS_AND_PRIVACY_VERSION,
        consentStatement:
          'أوافق إلكترونياً على شروط الاستخدام وسياسة الخصوصية وميثاق حفظ الأنساب وتوثيق السجلات في منصة جذوري عند تسجيل الحساب عبر Google.',
        ipAddress: silentGeo.ip || '127.0.0.1',
        ipCountry:
          silentGeo.ip_country || form.originCountry || selectedPortalCountry || 'السعودية',
        ipCity: silentGeo.ip_city || form.originRegion || '',
        verificationMethod: 'google_oauth',
      }).catch(() => {});

      let ticketNum = lineageResult.alphaBackgroundTicketCode || '—';
      const googleActiveResult = pendingHandoff?.result || lineageResult;
      const isGoogleDisambigTicket =
        pendingHandoff?.disambiguation_choice_id === 'not_sure_ticket';
      if (!googleActiveResult.matched || isGoogleDisambigTicket) {
        try {
          const syncedGoogleTicket = await syncClientLineageTicketToFirebase({
            userId: user.uid,
            userFullName: fullName,
            userEmail: user.email || '',
            userPhone: userPhone,
            familyName: googleActiveResult.familyName || form.familyName || 'جذوري',
            originCountry:
              googleActiveResult.originCountry ||
              form.originCountry ||
              selectedPortalCountry,
            originRegion: googleActiveResult.originRegion || form.originRegion,
            rootBranchName: googleActiveResult.rootBranchName || form.branchName,
            rootTribeName: googleActiveResult.rootTribeName || form.tribeName,
            matched: Boolean(googleActiveResult.matched && !isGoogleDisambigTicket),
            isAlphaOnlyBeforeMerge: googleActiveResult.isAlphaOnlyBeforeMerge,
            isAlphaMergedIntoAdam: googleActiveResult.isAlphaMergedIntoAdam,
            adamNodeId: googleActiveResult.adamNodeId,
            alphaBackgroundTicketCode:
              googleActiveResult.alphaBackgroundTicketCode,
            verifiedSources: googleActiveResult.verified_sources,
            corroboratingAlphaEvidence:
              googleActiveResult.corroborating_alpha_evidence_for_researcher,
            siblingBranches: googleActiveResult.sibling_branches_in_record,
            notablesInRecord: googleActiveResult.notables_in_record,
            enrichedLocations: googleActiveResult.enrichedLocations,
            adamSpineNodesCount: googleActiveResult.adamSpineNodes?.length || 1,
            subscriptionTier: 'free',
            isEscalatedDisambiguation: isGoogleDisambigTicket,
            additionalNotes: isGoogleDisambigTicket
              ? googleActiveResult.disambiguationPathsSummaryForTicket ||
                'طلب تحرٍّ أرشيفي أولي (P1) مفتوح عبر التسجيل بحساب Google.'
              : `طلب تحرٍّ وبحث عميل مباشر (P1) لعائلة (${googleActiveResult.familyName || form.familyName}) بعد تسجيل الحساب عبر Google.`,
          });
          if (syncedGoogleTicket) {
            ticketNum = syncedGoogleTicket.ticketNumber;
          }
        } catch (ticketErr) {
          console.warn('Could not auto-sync Google research ticket:', ticketErr);
        }
      }

      const googleExistingAnnual =
        existingProfile?.subscriptionTier === 'premium_annual' ||
        (typeof existingProfile?.paidRevenueUsd === 'number' &&
          existingProfile.paidRevenueUsd >= 55);
      const googleExistingRootPaid =
        existingProfile?.subscriptionTier === 'basic_verified' ||
        existingProfile?.isRootUnlocked === true ||
        (typeof existingProfile?.paidRevenueUsd === 'number' &&
          existingProfile.paidRevenueUsd >= 5);

      if (googleExistingAnnual) {
        setDashboardStateMode(DashboardStateMode.AnnualVip);
      } else if (googleExistingRootPaid) {
        setDashboardStateMode(DashboardStateMode.State1Paid5Basic);
      }

      await upsertCustomerOrderInFirebase({
        id: `ORD-${user.uid.slice(-6).toUpperCase()}`,
        userId: user.uid,
        fullName,
        firstName: form.firstName || fullName.split(' ')[0] || 'مستخدم',
        fatherName: form.fatherName,
        grandfatherName: form.grandfatherName,
        familyName: form.familyName || 'جذوري',
        originCountry: form.originCountry || selectedPortalCountry || 'السعودية',
        originRegion: form.originRegion || '',
        email: user.email || 'user@juthori.com',
        phone: userPhone || '—',
        legalRole:
          existingProfile?.accountType === 'record_keeper'
            ? 'record_keeper'
            : 'individual',
        accountStatus: googleExistingAnnual
          ? 'annual_vip'
          : googleExistingRootPaid
          ? 'paid_5_root'
          : 'free',
        walletBalanceUsd: existingProfile?.walletBalance ?? 0,
        paidRevenueUsd:
          existingProfile?.paidRevenueUsd ??
          (googleExistingAnnual ? 60 : googleExistingRootPaid ? 5 : 0),
        matchStatus: !lineageResult.matched
          ? 'open_research_ticket'
          : lineageResult.isAlphaOnlyBeforeMerge
          ? 'staged_3_nodes'
          : 'auto_adam_full',
        ticketId: ticketNum,
        ticketType: !lineageResult.matched
          ? 'طلب عميل P1'
          : lineageResult.isAlphaOnlyBeforeMerge
          ? 'إثراء شجرة آدم P2'
          : 'آلي مكتمل',
        assignedResearcher: 'فريق التحقيق النَّسبي',
        slaStatus: !lineageResult.matched
          ? 'جديدة'
          : lineageResult.isAlphaOnlyBeforeMerge
          ? 'قيد العمل'
          : 'مكتملة وتمت تغذية شجرة آدم',
        nodesCountLabel: lineageResult.matched
          ? `${lineageResult.adamSpineNodes.length} عقدة`
          : 'تذكرة بحث مفتوحة',
        createdAt: new Date().toISOString(),
      }).catch(() => {});

      setForm((prev) => ({
        ...prev,
        email: user.email || prev.email,
        agreedToTerms: true,
      }));

      syncRoutingForPendingTicketOrLineage();
      setHasActiveSession(true);
      setSearchStep(3);
      setPreviousPlatformView('dashboard');
      setActiveView('dashboard');
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (err) {
      console.warn('Google sign-in preservation failed:', err);
    }
  };

  const handleLoginSuccess = async (
    payload: PortalLoginSuccessPayload,
    options?: { stayOnMicrosite?: boolean }
  ) => {
    const resolvedUid =
      payload.uid ||
      auth.currentUser?.uid ||
      canonicalCustomerEmailUid(payload.email);
    if (resolvedUid) {
      setUserId(resolvedUid);
    }

    const pendingHandoff = readPendingLineageHandoff();
    const existingProfile =
      payload.profile !== undefined
        ? payload.profile
        : await (resolvedUid
            ? fetchUserProfile(resolvedUid)
            : Promise.resolve(null)
          ).then(
            (p) =>
              p || (payload.email ? fetchUserProfileByEmail(payload.email) : null)
          );

    if (existingProfile?.avatarUrl) {
      setUserAvatarUrl(existingProfile.avatarUrl);
    }
    setUserPhone(existingProfile?.phone || '');
    setUserDefaultCountry(
      existingProfile?.defaultCountry || payload.originCountry || 'السعودية'
    );

    const existingHasSavedLineage =
      Boolean(existingProfile?.familyName) &&
      !isEmailPrefixOrAsciiPlaceholder(existingProfile?.familyName, payload.email) &&
      Boolean(
        existingProfile?.verifiedLineageSnapshot || existingProfile?.lineageSnapshot
      );

    // 1. Check if we should migrate guest sessionStorage handoff immediately to Firestore
    if (
      pendingHandoff &&
      (payload.isNewRegistration || !existingHasSavedLineage)
    ) {
      const handoffForm: RegistrationFormState = {
        ...form,
        email: payload.email,
        firstName: pendingHandoff.firstName || payload.firstName,
        fatherName: pendingHandoff.fatherName || payload.fatherName,
        grandfatherName:
          pendingHandoff.grandfatherName || payload.grandfatherName,
        familyName: pendingHandoff.familyName || payload.familyName,
        originCountry: pendingHandoff.originCountry || payload.originCountry,
        originRegion:
          pendingHandoff.originRegion || payload.originRegion || '',
        tribeName: pendingHandoff.tribeName || payload.tribeName,
        branchName: pendingHandoff.branchName || payload.branchName,
        accountType: payload.accountType,
        agreedToTerms: true,
      };
      const handoffResult: LineageSearchResult = {
        ...pendingHandoff.result,
        clientName: handoffForm.firstName || pendingHandoff.result.clientName,
        fatherName: handoffForm.fatherName || pendingHandoff.result.fatherName,
        grandfatherName:
          handoffForm.grandfatherName || pendingHandoff.result.grandfatherName,
        familyName: handoffForm.familyName || pendingHandoff.result.familyName,
      };
      const handoffSnap = buildVerifiedLineageSnapshot(
        handoffResult,
        pendingHandoff.disambiguation_choice_id
      );

      if (resolvedUid) {
        const computedFull = [
          handoffForm.firstName,
          handoffForm.fatherName,
          handoffForm.grandfatherName,
          handoffForm.familyName,
        ]
          .filter(Boolean)
          .join(' ');
        updateUserProfile(resolvedUid, {
          fullName: computedFull,
          firstName: handoffForm.firstName,
          fatherName: handoffForm.fatherName,
          grandfatherName: handoffForm.grandfatherName,
          familyName: handoffForm.familyName,
          originCountry: handoffForm.originCountry,
          originRegion: handoffForm.originRegion,
          tribeName: handoffForm.tribeName,
          familyBranch: handoffForm.branchName,
          disambiguationChoiceId: pendingHandoff.disambiguation_choice_id,
          verifiedLineageSnapshot: handoffSnap,
          lineageSnapshot: handoffSnap,
        }).catch(() => {});
      }

      clearPendingLineageHandoff();
      setForm(handoffForm);
      setLineageResult(handoffResult);

      const handoffIsAnnual =
        payload.subscriptionTier === 'premium_annual' ||
        existingProfile?.subscriptionTier === 'premium_annual' ||
        (typeof existingProfile?.paidRevenueUsd === 'number' &&
          existingProfile.paidRevenueUsd >= 55);
      const handoffIsRootPaid =
        payload.subscriptionTier === 'basic_verified' ||
        payload.isRootUnlocked === true ||
        existingProfile?.subscriptionTier === 'basic_verified' ||
        existingProfile?.isRootUnlocked === true ||
        (typeof existingProfile?.paidRevenueUsd === 'number' &&
          existingProfile.paidRevenueUsd >= 5);

      const handoffMode = handoffIsAnnual
        ? DashboardStateMode.AnnualVip
        : handoffIsRootPaid
        ? DashboardStateMode.State1Paid5Basic
        : handoffResult.matched
        ? DashboardStateMode.State2MatchedUnpaid
        : handoffResult.recommendedInitialState;

      setDashboardStateMode(handoffMode);
      syncRoutingForPendingTicketOrLineage();
      setHasActiveSession(true);
      setSearchStep(3);
      setLoginModalOpen(false);
      setPreviousPlatformView('dashboard');
      setActiveView('dashboard');
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    // Clear stale guest handoff if returning customer already owns a verified saved path
    if (pendingHandoff && existingHasSavedLineage) {
      clearPendingLineageHandoff();
    }

    const updatedForm: RegistrationFormState = {
      ...form,
      email: payload.email,
      firstName: payload.firstName,
      fatherName: payload.fatherName,
      grandfatherName: payload.grandfatherName,
      familyName: payload.familyName,
      originCountry: payload.originCountry,
      originRegion: payload.originRegion || '',
      tribeName: payload.tribeName,
      branchName: payload.branchName,
      accountType: payload.accountType,
      agreedToTerms: true,
    };
    setForm(updatedForm);

    const savedSnap =
      existingProfile?.verifiedLineageSnapshot ||
      existingProfile?.lineageSnapshot;
    const hydratedFromFirestore = hydrateLineageResultFromSnapshot(savedSnap, {
      firstName: payload.firstName,
      fatherName: payload.fatherName,
      grandfatherName: payload.grandfatherName,
      familyName: payload.familyName,
      originCountry: payload.originCountry,
      originRegion: payload.originRegion,
    });

    const immediateResult =
      hydratedFromFirestore ||
      resolveDeterministicLineage({
        firstName: payload.firstName,
        fatherName: payload.fatherName,
        grandfatherName: payload.grandfatherName,
        familyName: payload.familyName,
        originCountry: payload.originCountry,
        originRegion: payload.originRegion || '',
        tribeName: payload.tribeName,
        branchName: payload.branchName,
      });
    setLineageResult(immediateResult);

    const targetMode = resolveCustomerTierStateMode(
      {
        subscriptionTier:
          payload.subscriptionTier || existingProfile?.subscriptionTier,
        isRootUnlocked:
          payload.isRootUnlocked === true ||
          existingProfile?.isRootUnlocked === true,
        paidRevenueUsd: existingProfile?.paidRevenueUsd,
      },
      immediateResult
    );

    setDashboardStateMode(targetMode);
    setInitialDashboardTab(DashboardTab.Home);
    setHasActiveSession(true);
    setSearchStep(3);
    setLoginModalOpen(false);
    setPreviousPlatformView('dashboard');
    if (!options?.stayOnMicrosite) {
      setActiveView('dashboard');
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    // Only run background engine query if this account did NOT have a saved `verifiedLineageSnapshot` yet
    if (!hydratedFromFirestore && payload.familyName) {
      searchJuthoriLineage(
        updatedForm,
        {
          ip_country: silentGeo.ip_country,
          ip_city: silentGeo.ip_city,
        },
        existingProfile?.disambiguationChoiceId
      )
        .then((liveRes) => {
          if (!liveRes) return;
          const mergedLive: LineageSearchResult = {
            ...liveRes,
            clientName: payload.firstName || liveRes.clientName,
            fatherName: payload.fatherName || liveRes.fatherName,
            grandfatherName: payload.grandfatherName || liveRes.grandfatherName,
            requiresBlindDisambiguation:
              payload.tribeName ||
              payload.branchName ||
              existingProfile?.disambiguationChoiceId
                ? false
                : liveRes.requiresBlindDisambiguation,
          };
          setLineageResult(mergedLive);
          if (mergedLive.matched) {
            setDashboardStateMode((currMode) =>
              currMode === DashboardStateMode.State3Unmatched
                ? DashboardStateMode.State2MatchedUnpaid
                : currMode
            );
          }
          if (resolvedUid) {
            const snap = buildVerifiedLineageSnapshot(
              mergedLive,
              existingProfile?.disambiguationChoiceId
            );
            updateUserProfile(resolvedUid, {
              verifiedLineageSnapshot: snap,
              lineageSnapshot: snap,
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }
  };

  // Explicit lightweight "إعادة مزامنة الفحص" handler inside CustomerDashboard
  const handleManualResyncLineage = async () => {
    if (!form.familyName && !lineageResult.familyName) return;
    setIsResyncingLineage(true);
    try {
      const targetForm: RegistrationFormState = {
        ...form,
        firstName: form.firstName || lineageResult.clientName || 'عميل',
        fatherName: form.fatherName || lineageResult.fatherName || '',
        grandfatherName:
          form.grandfatherName || lineageResult.grandfatherName || '',
        familyName: form.familyName || lineageResult.familyName,
        originCountry:
          form.originCountry || lineageResult.originCountry || 'السعودية',
        originRegion: form.originRegion || lineageResult.originRegion || '',
        tribeName: form.tribeName || lineageResult.rootTribeName || '',
        branchName: form.branchName || lineageResult.rootBranchName || '',
      };

      const refreshed = await searchJuthoriLineage(targetForm, {
        ip_country: silentGeo.ip_country,
        ip_city: silentGeo.ip_city,
      });

      const mergedRefreshed: LineageSearchResult = {
        ...refreshed,
        clientName: targetForm.firstName || refreshed.clientName,
        fatherName: targetForm.fatherName || refreshed.fatherName,
        grandfatherName: targetForm.grandfatherName || refreshed.grandfatherName,
        requiresBlindDisambiguation:
          targetForm.tribeName || targetForm.branchName
            ? false
            : refreshed.requiresBlindDisambiguation,
      };

      setLineageResult(mergedRefreshed);
      if (
        mergedRefreshed.matched &&
        dashboardStateMode === DashboardStateMode.State3Unmatched
      ) {
        setDashboardStateMode(DashboardStateMode.State2MatchedUnpaid);
      }

      const activeUid =
        userId ||
        auth.currentUser?.uid ||
        canonicalCustomerEmailUid(form.email);
      if (activeUid) {
        const snap = buildVerifiedLineageSnapshot(mergedRefreshed);
        await updateUserProfile(activeUid, {
          verifiedLineageSnapshot: snap,
          lineageSnapshot: snap,
        }).catch(() => {});
      }
    } catch {
      // Graceful silent fallback if remote tunnel is temporarily unreachable
    } finally {
      setIsResyncingLineage(false);
    }
  };

  const resetAllCustomerSessionState = () => {
    setHasActiveSession(false);
    setUserId('');
    setUserAvatarUrl('');
    setUserPhone('');
    setClaimedKinshipRelation('');
    setUserDefaultCountry('السعودية');
    setDashboardStateMode(DashboardStateMode.State3Unmatched);
    setForm(DEFAULT_FORM_STATE);
    setLineageResult(
      resolveDeterministicLineage({
        firstName: '',
        fatherName: '',
        grandfatherName: '',
        familyName: '',
        originCountry: 'السعودية',
        originRegion: '',
        tribeName: '',
        branchName: '',
      })
    );
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    }
    clearAllPortalSessionUnlocks();
    signOutAllCustomerAuthSessions().catch(() => {});
  };

  const handleLogoutCustomer = () => {
    resetAllCustomerSessionState();
    setSearchStep(1);
    setPreviousPlatformView('landing');
    setActiveView('landing');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const handlePortalSignOut = () => {
    resetAllCustomerSessionState();
    setSearchStep(1);
    setPreviousPlatformView('landing');
  };

  // Live Researcher Studio Callback inside Staff Portal: Merge Alpha or P1 ticket nodes into Adam's Tree
  const handleApproveAlphaMergeIntoAdam = ({
    familyName,
    subRootName,
    motherTribeName,
    isAdamEnrichmentOnly,
    addedVerifiedSources = [],
    addedSiblingBranches = [],
    addedNotables = [],
    addedLocations = [],
    customUpperTribe,
    customExtractedNodes,
    customJunctionNodeName,
  }: {
    familyName: string;
    subRootName: string;
    motherTribeName: string;
    approveSources: boolean;
    isAdamEnrichmentOnly?: boolean;
    addedVerifiedSources?: string[];
    addedSiblingBranches?: string[];
    addedNotables?: string[];
    addedLocations?: string[];
    customUpperTribe?: 'بني لام' | 'تميم' | 'مذحج' | 'عنزة';
    customExtractedNodes?: {
      name: string;
      nodeCode: string;
      relationType: 'bin' | 'aan';
      region?: string;
    }[];
    customJunctionNodeName?: string;
  }) => {
    if (isAdamEnrichmentOnly) {
      setLineageResult((prev) => {
        const isSameFamily =
          prev.familyName === familyName ||
          prev.familyName.includes(familyName) ||
          familyName.includes(prev.familyName);

        const baseTarget = isSameFamily
          ? prev
          : resolveDeterministicLineage({
              firstName: form.firstName || 'عميل',
              fatherName: form.fatherName || '',
              grandfatherName: form.grandfatherName || '',
              familyName: familyName || prev.familyName,
              originCountry: prev.originCountry || 'السعودية',
              originRegion:
                familyName.includes('قاسم')
                  ? 'نجران'
                  : familyName.includes('خابور')
                  ? 'نجد'
                  : prev.originRegion || '',
              tribeName: motherTribeName || '',
              branchName: subRootName || '',
            });

        const mergedSources = Array.from(
          new Set([
            ...(baseTarget.verified_sources || []),
            ...(baseTarget.secondarySources || []),
            ...addedVerifiedSources,
          ])
        );
        const mergedSiblings = Array.from(
          new Set([
            ...(baseTarget.sibling_branches_in_record || []),
            ...(baseTarget.siblingBranches || []),
            ...addedSiblingBranches,
          ])
        );
        const mergedNotables = Array.from(
          new Set([...(baseTarget.notables_in_record || []), ...addedNotables])
        );
        const mergedLocations = Array.from(
          new Set([...(baseTarget.enrichedLocations || []), ...addedLocations])
        );

        return {
          ...baseTarget,
          isAdamNodeEnrichedWithAlpha: true,
          verified_sources: mergedSources,
          secondarySources: mergedSources,
          verifiedSourceCitation:
            mergedSources.slice(0, 3).join(' | ') || baseTarget.verifiedSourceCitation,
          sibling_branches_in_record: mergedSiblings,
          siblingBranches: mergedSiblings,
          siblingBranchesLabel:
            mergedSiblings.length > 0
              ? `الفروع الشقيقة المجمعة في السجل (${mergedSiblings.length} فروع): ${mergedSiblings.join('، ')}`
              : baseTarget.siblingBranchesLabel,
          notables_in_record: mergedNotables,
          enrichedLocations: mergedLocations,
          confidenceLabel: `تطابق محقق في شجرة آدم (${baseTarget.adamSpineNodes.length} عقدة) — تم إثراء العقدة بالمصادر الإضافية من مشاريع ألفا وإقفال التذكرة ✓`,
        };
      });
      return;
    }

    setIsAlphaMergedIntoAdam(true);
    setLineageResult((prev) => {
      const applyExtraEnrichment = (res: LineageSearchResult): LineageSearchResult => {
        const mergedSources =
          !isAdamEnrichmentOnly && addedVerifiedSources.length > 0
            ? Array.from(new Set(addedVerifiedSources))
            : Array.from(
                new Set([
                  ...(res.verified_sources || []),
                  ...(res.secondarySources || []),
                  ...addedVerifiedSources,
                ])
              );
        const mergedSiblings = Array.from(
          new Set([
            ...(res.sibling_branches_in_record || []),
            ...(res.siblingBranches || []),
            ...addedSiblingBranches,
          ])
        );
        const mergedNotables = Array.from(
          new Set([...(res.notables_in_record || []), ...addedNotables])
        );
        const mergedLocations = Array.from(
          new Set([...(res.enrichedLocations || []), ...addedLocations])
        );

        return {
          ...res,
          verifiedSourceCitation:
            mergedSources[0] || res.verifiedSourceCitation,
          verified_sources: mergedSources,
          secondarySources: mergedSources,
          sibling_branches_in_record: mergedSiblings,
          siblingBranches: mergedSiblings,
          notables_in_record: mergedNotables,
          enrichedLocations: mergedLocations,
        };
      };

      const isTargetSameAsCurrent =
        !familyName ||
        prev.familyName === familyName ||
        prev.familyName.includes(familyName) ||
        familyName.includes(prev.familyName);

      if (isTargetSameAsCurrent) {
        return applyExtraEnrichment(
          upgradeAlphaResultToMergedAdam(
            {
              ...prev,
              rootBranchName: subRootName || prev.rootBranchName,
              rootTribeName: motherTribeName || prev.rootTribeName,
            },
            {
              customExtractedNodes,
              junctionNodeName: customJunctionNodeName,
            }
          )
        );
      }

      const resolved = resolveDeterministicLineage({
        firstName: form.firstName || 'عميل',
        fatherName: form.fatherName || '',
        grandfatherName: form.grandfatherName || '',
        familyName: familyName || prev.familyName,
        originCountry: prev.originCountry || 'العراق',
        originRegion: prev.originRegion || '',
        tribeName: motherTribeName || '',
        branchName: subRootName || '',
      });
      return applyExtraEnrichment(
        upgradeAlphaResultToMergedAdam(resolved, {
          customExtractedNodes,
          junctionNodeName: customJunctionNodeName,
        })
      );
    });
  };

  // Preview any specific Client Order directly from the Staff Portal
  const handlePreviewClientOrder = (order: {
    firstName: string;
    fatherName: string;
    grandfatherName: string;
    familyName: string;
    originCountry: string;
    originRegion: string;
    accountType: AccountLegalType;
    stateMode: DashboardStateMode;
    email: string;
  }) => {
    setForm((prev) => ({
      ...prev,
      firstName: order.firstName,
      fatherName: order.fatherName,
      grandfatherName: order.grandfatherName,
      familyName: order.familyName,
      originCountry: order.originCountry,
      originRegion: order.originRegion,
      accountType: order.accountType,
      email: order.email,
    }));

    if (typeof window !== 'undefined' && isTeamRouteInWindow()) {
      window.history.pushState({}, '', '/');
    }

    if (
      lineageResult.familyName === order.familyName &&
      (lineageResult.isAdamNodeEnrichedWithAlpha ||
        lineageResult.isAlphaMergedIntoAdam)
    ) {
      setDashboardStateMode(order.stateMode);
      setHasActiveSession(true);
      setSearchStep(3);
      setPreviousPlatformView('dashboard');
      setActiveView('dashboard');
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return;
    }

    const baseRes = resolveDeterministicLineage({
      firstName: order.firstName,
      fatherName: order.fatherName,
      grandfatherName: order.grandfatherName,
      familyName: order.familyName,
      originCountry: order.originCountry,
      originRegion: order.originRegion,
      tribeName: '',
      branchName: '',
    });

    const finalRes =
      baseRes.isAlphaOnlyBeforeMerge && isAlphaMergedIntoAdam
        ? upgradeAlphaResultToMergedAdam(baseRes)
        : baseRes;

    setLineageResult(finalRes);
    setDashboardStateMode(order.stateMode);
    setHasActiveSession(true);
    setSearchStep(3);
    setPreviousPlatformView('dashboard');
    setActiveView('dashboard');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  // Update immediate parents (Father & Grandfather) when added inline by the client and persist to Firestore
  const handleUpdateImmediateParents = (
    nextFatherName: string,
    nextGrandfatherName: string
  ) => {
    const cleanFather = nextFatherName.trim() === '—' ? '' : nextFatherName.trim();
    const cleanGrandfather =
      nextGrandfatherName.trim() === '—' ? '' : nextGrandfatherName.trim();
    setForm((prev) => {
      const nextFullName = [
        prev.firstName,
        cleanFather,
        cleanGrandfather,
        prev.familyName,
      ]
        .filter(Boolean)
        .join(' ');
      const activeUid =
        userId ||
        auth.currentUser?.uid ||
        canonicalCustomerEmailUid(prev.email);
      if (activeUid) {
        updateUserProfile(activeUid, {
          fullName: nextFullName || undefined,
          fatherName: cleanFather,
          grandfatherName: cleanGrandfather,
        }).catch(() => {});
      }
      return {
        ...prev,
        fatherName: cleanFather,
        grandfatherName: cleanGrandfather,
      };
    });
    setLineageResult((prev) => ({
      ...prev,
      fatherName: cleanFather,
      grandfatherName: cleanGrandfather,
    }));
  };

  // Update full profile details from Profile & Settings drawer or Verification choice
  const handleUpdateProfileDetails = (details: {
    firstName: string;
    fatherName: string;
    grandfatherName: string;
    familyName: string;
    phone: string;
    defaultCountry: string;
    originCountry: string;
    originRegion: string;
    tribeName?: string;
    branchName?: string;
    avatarUrl?: string;
  }) => {
    if (details.avatarUrl !== undefined) {
      setUserAvatarUrl(details.avatarUrl);
    }
    setUserPhone(details.phone);
    setUserDefaultCountry(details.defaultCountry);

    setForm((prev) => ({
      ...prev,
      firstName: details.firstName,
      fatherName: details.fatherName,
      grandfatherName: details.grandfatherName,
      familyName: details.familyName,
      originCountry: details.originCountry,
      originRegion: details.originRegion,
      tribeName: details.tribeName !== undefined ? details.tribeName : prev.tribeName,
      branchName: details.branchName !== undefined ? details.branchName : prev.branchName,
    }));

    setLineageResult((prev) => ({
      ...prev,
      clientName: details.firstName || prev.clientName,
      fatherName: details.fatherName,
      grandfatherName: details.grandfatherName,
      familyName: details.familyName || prev.familyName,
      originCountry: details.originCountry || prev.originCountry,
      originRegion: details.originRegion || prev.originRegion,
      rootTribeName: details.tribeName || prev.rootTribeName,
      rootBranchName: details.branchName || prev.rootBranchName,
    }));
  };

  const handleKinshipClaimCompleted = (
    payload: ClaimedKinshipSessionPayload,
    options?: { enterOwnDashboardIfNoSite?: boolean }
  ) => {
    setUserId(payload.uid);
    setHasActiveSession(true);
    setUserAvatarUrl(auth.currentUser?.photoURL || '');
    setUserPhone(payload.phone || '');
    setClaimedKinshipRelation(payload.kinshipRelation || '');
    setUserDefaultCountry(
      payload.residenceCountry || payload.originCountry || 'السعودية'
    );
    setPendingInviteToken(null);
    setStandaloneClaimModalOpen(false);
    setStandaloneInvitation(null);

    const nextClaimedForm: RegistrationFormState = {
      ...DEFAULT_FORM_STATE,
      accountType: AccountLegalType.Individual,
      firstName: payload.firstName || 'عضو',
      fatherName: payload.fatherName || '',
      grandfatherName: payload.grandfatherName || '',
      familyName: payload.familyName || 'العائلة',
      originCountry: payload.originCountry || 'السعودية',
      originRegion: payload.originRegion || '',
      tribeName: payload.tribeName || '',
      branchName: payload.branchName || '',
      email: payload.email,
      agreedToTerms: true,
    };
    setForm(nextClaimedForm);

    const matchedLineage =
      payload.matchedLineage ||
      resolveDeterministicLineage({
        firstName: nextClaimedForm.firstName,
        fatherName: nextClaimedForm.fatherName,
        grandfatherName: nextClaimedForm.grandfatherName,
        familyName: nextClaimedForm.familyName,
        originCountry: nextClaimedForm.originCountry,
        originRegion: nextClaimedForm.originRegion,
        tribeName: nextClaimedForm.tribeName,
        branchName: nextClaimedForm.branchName,
      });
    setLineageResult(matchedLineage);

    // Strict Zero-Leak Tier Resolution: newly claimed invited accounts default strictly to free/unpaid (NEVER inherit inviter's AnnualVip)
    const nextTierMode = resolveCustomerTierStateMode(
      {
        subscriptionTier: payload.subscriptionTier || 'free',
        isRootUnlocked: payload.isRootUnlocked === true,
      },
      matchedLineage
    );
    setDashboardStateMode(nextTierMode);
    setSearchStep(3);
    setPreviousPlatformView('dashboard');

    if (options?.enterOwnDashboardIfNoSite && !publicMicrositeSlug) {
      setActiveView('dashboard');
    }
  };

  return (
    <>
      {optOutFeedbackModal && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[130] bg-[#1F1F1C]/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] shadow-2xl overflow-hidden">
            <div className="bg-[#E8DED2] text-[#1F1F1C] px-6 py-4 border-b border-[#D8C7B2]">
              <p className="text-[11px] font-bold text-[#D97757] mb-1">
                حماية الخصوصية الفورية — منصة جذوري
              </p>
              <h3 className="text-base font-display font-bold text-[#1F1F1C]">
                {optOutFeedbackModal.ok
                  ? 'تم حذف بريدك وإلغاء الإدراج فوراً ✓'
                  : 'حالة رابط إلغاء الإدراج'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs sm:text-sm text-[#1F1F1C] leading-relaxed font-medium">
                {optOutFeedbackModal.messageAr}
              </p>
              <div className="rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] p-3 text-[11px] text-[#1F1F1C]/75 leading-relaxed">
                لا يتطلب هذا الإجراء تسجيل الدخول أو إنشاء حساب، ولن تصلك أي دعوات مستقبلية من هذه الدائرة العائلية على هذا البريد الإلكتروني.
              </div>
              <button
                type="button"
                onClick={() => setOptOutFeedbackModal(null)}
                className="w-full py-2.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold transition-colors cursor-pointer"
              >
                حسناً، إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {standaloneInvitation && !publicMicrositeSlug && (
        <KinshipInviteClaimModal
          isOpen={standaloneClaimModalOpen}
          invitation={standaloneInvitation}
          onClose={() => {
            setStandaloneClaimModalOpen(false);
            clearPendingInviteToken();
            setPendingInviteToken(null);
          }}
          onClaimCompleted={(claimed) =>
            handleKinshipClaimCompleted(claimed, {
              enterOwnDashboardIfNoSite: true,
            })
          }
          onOptOutCompleted={(msgAr) => {
            setStandaloneClaimModalOpen(false);
            setStandaloneInvitation(null);
            setPendingInviteToken(null);
            setOptOutFeedbackModal({
              ok: true,
              messageAr: msgAr,
            });
          }}
        />
      )}

      {activeView === 'staff_portal' ? (
        <AdminStaffPortal
          currentClientResult={lineageResult}
          currentClientStateMode={dashboardStateMode}
          currentClientAccountType={form.accountType}
          currentClientEmail={form.email || ''}
          isAlphaAlreadyMerged={
            isAlphaMergedIntoAdam || !!lineageResult.isAlphaMergedIntoAdam
          }
          onApproveAlphaMergeIntoAdam={handleApproveAlphaMergeIntoAdam}
          onPreviewClientOrder={handlePreviewClientOrder}
          onManualUpgradeActiveClient={(nextMode, nextRole) => {
            setDashboardStateMode(nextMode);
            if (nextRole) {
              setForm((prev) => ({ ...prev, accountType: nextRole }));
            }
          }}
          onBackToPlatform={() => {
            if (typeof window !== 'undefined' && isTeamRouteInWindow()) {
              window.history.pushState({}, '', '/');
            }
            setActiveView(hasActiveSession ? 'dashboard' : previousPlatformView);
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          }}
        />
      ) : publicMicrositeSlug ? (
        <PublicFamilyMicrositePage
          siteSlug={publicMicrositeSlug}
          inviteToken={pendingInviteToken}
          viewerEmail={form.email || auth.currentUser?.email || ''}
          viewerName={[form.firstName, form.familyName]
            .filter((part) => part && part !== 'مستخدم')
            .join(' ')}
          viewerAvatarUrl={userAvatarUrl}
          viewerKinshipRelation={claimedKinshipRelation}
          viewerIsAnnualVip={dashboardStateMode === DashboardStateMode.AnnualVip}
          onInvitationClaimed={(claimed) =>
            handleKinshipClaimCompleted(claimed, {
              enterOwnDashboardIfNoSite: false,
            })
          }
          onPortalLoginSuccess={(loginPayload) => {
            void handleLoginSuccess(loginPayload, { stayOnMicrosite: true });
          }}
          onPortalSignOut={handlePortalSignOut}
          onUpgradeOwnMembershipToAnnualVip={(ctx) => {
            if (typeof window !== 'undefined') {
              window.history.pushState({}, '', '/');
            }
            setPublicMicrositeSlug(null);

            const targetFamily = (
              form.familyName ||
              ctx?.familyName ||
              'العائلة'
            ).trim();
            const targetCountry = (
              form.originCountry ||
              ctx?.originCountry ||
              'السعودية'
            ).trim();

            if (!form.familyName || form.familyName !== targetFamily) {
              const nextUpgradeForm: RegistrationFormState = {
                ...form,
                firstName:
                  form.firstName && form.firstName !== 'مستخدم'
                    ? form.firstName
                    : 'عضو',
                familyName: targetFamily,
                originCountry: targetCountry,
              };
              setForm(nextUpgradeForm);
              const seededLineage = resolveDeterministicLineage({
                firstName: nextUpgradeForm.firstName,
                fatherName: nextUpgradeForm.fatherName,
                grandfatherName: nextUpgradeForm.grandfatherName,
                familyName: targetFamily,
                originCountry: targetCountry,
                originRegion: nextUpgradeForm.originRegion,
                tribeName: nextUpgradeForm.tribeName,
                branchName: nextUpgradeForm.branchName,
              });
              setLineageResult(seededLineage);
            }

            if (hasActiveSession || auth.currentUser) {
              setInitialDashboardTab(DashboardTab.Lineage);
              setAutoOpenVipUpgradeInDashboard(true);
              setActiveView('dashboard');
            } else {
              setActiveView('landing');
              setSearchStep(1);
              setLoginModalOpen(true);
            }
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          }}
          onGoToOwnDashboard={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState({}, '', '/');
            }
            setPublicMicrositeSlug(null);
            setInitialDashboardTab(DashboardTab.Home);
            setActiveView('dashboard');
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          }}
          onGoToOwnSiteSettings={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState({}, '', '/');
            }
            setPublicMicrositeSlug(null);
            setInitialDashboardTab(DashboardTab.MySite);
            setActiveView('dashboard');
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          }}
          onExitToMainApp={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState({}, '', '/');
            }
            setPublicMicrositeSlug(null);
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          }}
          onStartOwnLineageSearch={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState({}, '', '/');
            }
            setPublicMicrositeSlug(null);
            setActiveView('landing');
            setSearchStep(1);
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          }}
        />
      ) : activeView === 'landing' ? (
        <LandingPage
          form={form}
          onChangeForm={setForm}
          selectedPortalCountry={selectedPortalCountry}
          onSelectPortalCountry={(countryName) => {
            setUserManuallySelectedCountry(true);
            setSelectedPortalCountry(countryName);
          }}
          onSubmitSearch={handleSubmitSearch}
          onDirectFreeSignup={handleDirectFreeSignup}
          onGoogleFreeSignup={handleGoogleDirectFreeSignup}
          isSearching={isSearching}
          searchStep={searchStep}
          onOpenLogin={() => setLoginModalOpen(true)}
          isAuthenticated={hasActiveSession}
          onOpenDashboardForPlan={(intent) => {
            if (intent) {
              setSelectedPlanIntentForDashboard(intent);
            }
            setInitialDashboardTab(DashboardTab.Home);
            setActiveView('dashboard');
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          }}
          silentGeo={silentGeo}
        />
      ) : activeView === 'searching' ? (
        <SearchProgressScreen
          form={form}
          result={lineageResult}
          onCompletePreservation={handleCompletePreservation}
          onGoogleSignInPreserve={handleGoogleSignInPreserve}
          onOpenLoginModal={() => setLoginModalOpen(true)}
          onBackToEdit={() => {
            setSearchStep(1);
            setActiveView('landing');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      ) : (
        <CustomerDashboard
          stateMode={dashboardStateMode}
          onChangeStateMode={setDashboardStateMode}
          accountType={form.accountType}
          onUpgradeAccountToRecordKeeper={() => {
            setForm((prev) => ({
              ...prev,
              accountType: AccountLegalType.RecordKeeper,
            }));
            const activeUid = userId || auth.currentUser?.uid;
            if (activeUid) {
              updateUserProfile(activeUid, {
                accountType: 'record_keeper',
              }).catch(() => {});
            }
          }}
          onToggleAccountTypeForTest={(nextRole) =>
            setForm((prev) => ({
              ...prev,
              accountType: nextRole,
            }))
          }
          result={lineageResult}
          silentGeo={silentGeo}
          userEmail={form.email || auth.currentUser?.email || 'user@juthori.com'}
          userId={userId || auth.currentUser?.uid}
          userAvatarUrl={userAvatarUrl}
          userPhone={userPhone}
          userDefaultCountry={userDefaultCountry || form.originCountry}
          userOriginRegion={form.originRegion}
          onBackToLanding={() => {
            setSearchStep(1);
            setPreviousPlatformView('landing');
            setActiveView('landing');
            window.scrollTo({ top: 0, behavior: 'auto' });
          }}
          onLogout={handleLogoutCustomer}
          onUpdateImmediateParents={handleUpdateImmediateParents}
          onUpdateProfileDetails={handleUpdateProfileDetails}
          onUpdateLineageResult={(nextRes) => setLineageResult(nextRes)}
          onDeleteAccount={async () => {
            handleLogoutCustomer();
          }}
          initialTab={initialDashboardTab}
          initialTicketDraft={pendingTicketDraftState}
          onClearInitialTicketDraft={() => setPendingTicketDraftState(null)}
          initialAutoOpenVipUpgrade={autoOpenVipUpgradeInDashboard}
          onClearAutoOpenVipUpgrade={() =>
            setAutoOpenVipUpgradeInDashboard(false)
          }
          initialSelectedPlanIntent={selectedPlanIntentForDashboard}
          onClearInitialPlanIntent={() =>
            setSelectedPlanIntentForDashboard(null)
          }
          onResyncLineageFromEngine={handleManualResyncLineage}
          isResyncingLineage={isResyncingLineage}
        />
      )}

      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
}

export default App;
