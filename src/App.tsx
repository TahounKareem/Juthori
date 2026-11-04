import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from './services/firebase';
import {
  fetchUserProfile,
  fetchUserProfileByEmail,
  updateUserProfile,
  createUserProfileIfMissing,
  createResearchTicket,
  syncClientLineageTicketToFirebase,
  upsertCustomerOrderInFirebase,
  bootstrapJuthoriFirestoreDatabase,
} from './services/firestoreService';
import {
  AccountLegalType,
  DashboardStateMode,
  LineageSearchResult,
  RegistrationFormState,
  SilentGeoMetadata,
} from './types/juthori';
import { resolveVisitorCountryName } from './data/arabCountries';
import {
  resolveDeterministicLineage,
  searchJuthoriLineage,
  upgradeAlphaResultToMergedAdam,
} from './utils/lineageEngine';
import { LandingPage } from './components/LandingPage';
import { SearchProgressScreen } from './components/SearchProgressScreen';
import { CustomerDashboard } from './components/CustomerDashboard';
import { LoginModal } from './components/LoginModal';
import { AdminStaffPortal } from './components/AdminStaffPortal';

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

const DEFAULT_DEMO_SEED = {
  accountType: AccountLegalType.Individual,
  firstName: 'حسن',
  fatherName: '',
  grandfatherName: '',
  familyName: 'آل مقيت',
  originCountry: 'السعودية',
  tribeName: 'بني بشر',
  branchName: 'آل برمان',
  email: 'hassan.almuqit@juthori.com',
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
      const fam = (parsed.lineageResult?.familyName || parsed.form?.familyName || '').trim();
      if (
        em === 'hassan.almuqit@juthori.com' ||
        em === 'kareem.tahoun@adamresearchcenter.net' ||
        em === 'client@juthori.com' ||
        fam === 'طاحون'
      ) {
        localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
        return null;
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
    hash === '#/team' ||
    hash === '#team' ||
    viewParam === 'team' ||
    viewParam === 'staff' ||
    viewParam === 'admin' ||
    viewParam === 'researcher'
  );
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
    () => initialSession?.lineageResult || resolveDeterministicLineage(DEFAULT_DEMO_SEED)
  );
  const [dashboardStateMode, setDashboardStateMode] = useState<DashboardStateMode>(
    () => initialSession?.dashboardStateMode || DashboardStateMode.State2MatchedUnpaid
  );

  // Listen for URL changes to /Team or #/Team and bootstrap Firestore collections
  useEffect(() => {
    bootstrapJuthoriFirestoreDatabase().catch(() => {});
    if (typeof window === 'undefined') return;
    const handleLocationChange = () => {
      if (isTeamRouteInWindow()) {
        setActiveView('staff_portal');
      }
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

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
        const [byUid, byEmail] = await Promise.all([
          cachedUid ? fetchUserProfile(cachedUid) : Promise.resolve(null),
          cachedEmail ? fetchUserProfileByEmail(cachedEmail) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (!byUid && !byEmail) {
          // User was deleted from Firestore `users` — purge cached session and sign out
          localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
          localStorage.removeItem('juthori_active_customer_session_v1');
          signOut(auth).catch(() => {});
          setHasActiveSession(false);
          setUserId('');
          setUserAvatarUrl('');
          setSearchStep(1);
          setPreviousPlatformView('landing');
          setActiveView((curr) => (curr === 'staff_portal' ? curr : 'landing'));
        }
      } catch {
        // Ignore transient offline errors
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Firebase Auth Observer to synchronize logged-in user profile and keep customer session active
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Ignore anonymous sessions or team portal sessions
        if (user.isAnonymous) return;
        setUserId(user.uid);
        try {
          const [profileByUid, profileByEmail] = await Promise.all([
            fetchUserProfile(user.uid),
            user.email ? fetchUserProfileByEmail(user.email) : Promise.resolve(null),
          ]);
          const profile =
            (profileByEmail?.familyName ? profileByEmail : null) ||
            (profileByUid?.familyName ? profileByUid : null) ||
            profileByEmail ||
            profileByUid;

          if (!profile || profile.familyName === 'طاحون') {
            // If this authenticated user has no customer profile in `users` (e.g. deleted from Firebase by admin)
            // and we are not on `/Team`, sign out Firebase Auth and clear any stale customer session in localStorage
            if (!isTeamRouteInWindow()) {
              localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
              localStorage.removeItem('juthori_active_customer_session_v1');
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

          if (profile) {
            const nameParts = (profile.fullName || user.displayName || '')
              .split(' ')
              .filter(Boolean);
            const resolvedFirst = profile.firstName || nameParts[0] || '';
            const resolvedFather =
              profile.fatherName || (nameParts.length > 2 ? nameParts[1] : '') || '';
            const resolvedGrand =
              profile.grandfatherName ||
              (nameParts.length > 3 ? nameParts[2] : '') ||
              '';
            const resolvedFamily =
              profile.familyName ||
              (nameParts.length > 3
                ? nameParts.slice(3).join(' ')
                : nameParts.length > 1
                ? nameParts.slice(1).join(' ')
                : '');

            if (resolvedFamily === 'طاحون') {
              return;
            }

            if (profile.avatarUrl) {
              setUserAvatarUrl(profile.avatarUrl);
            }
            if (profile.phone) {
              setUserPhone(profile.phone);
            }
            if (profile.defaultCountry) {
              setUserDefaultCountry(profile.defaultCountry);
            }

            const resolvedCountry = profile.originCountry || 'السعودية';
            const resolvedRegion = profile.originRegion || '';
            const resolvedTribe = profile.tribeName || '';
            const resolvedBranch = profile.familyBranch || '';
            const resolvedAccountType =
              profile.accountType === 'record_keeper'
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
              const nextLineage = resolveDeterministicLineage({
                firstName: resolvedFirst || 'مستخدم',
                fatherName: resolvedFather,
                grandfatherName: resolvedGrand,
                familyName: resolvedFamily,
                originCountry: resolvedCountry,
                originRegion: resolvedRegion,
                tribeName: resolvedTribe,
                branchName: resolvedBranch,
              });
              setLineageResult(nextLineage);

              // Also fetch from Live German Engine in background while honoring saved verification answer
              searchJuthoriLineage(nextForm, {
                ip_country: silentGeo.ip_country,
                ip_city: silentGeo.ip_city,
              })
                .then((liveRes) => {
                  if (liveRes && liveRes.matched) {
                    setLineageResult(
                      resolvedTribe || resolvedBranch
                        ? { ...liveRes, requiresBlindDisambiguation: false }
                        : liveRes
                    );
                  }
                })
                .catch(() => {});

              if (profile.subscriptionTier === 'premium_annual') {
                setDashboardStateMode(DashboardStateMode.AnnualVip);
              } else if (
                profile.subscriptionTier === 'basic_verified' ||
                profile.isRootUnlocked
              ) {
                setDashboardStateMode(DashboardStateMode.State1Paid5Basic);
              } else {
                setDashboardStateMode(nextLineage.recommendedInitialState);
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

  // Step 1: Submit search from Landing Page -> launches intermediate Verification Screen (Step 2)
  const handleSubmitSearch = async () => {
    setIsSearching(true);
    setIsAlphaMergedIntoAdam(false);
    setForm((prev) => ({ ...prev, accountType: AccountLegalType.Individual }));

    const rawResult = await searchJuthoriLineage(
      { ...form, accountType: AccountLegalType.Individual },
      {
        ip_country: silentGeo.ip_country,
        ip_city: silentGeo.ip_city,
      }
    );

    setLineageResult(rawResult);
    setDashboardStateMode(rawResult.recommendedInitialState);
    setSearchStep(2);
    setIsSearching(false);
    setActiveView('searching');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
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
    let uid = auth.currentUser?.uid || userId;
    if (!uid) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        uid = cred.user.uid;
      } catch {
        try {
          const cred = await signInWithEmailAndPassword(auth, email, password);
          uid = cred.user.uid;
        } catch {
          uid = `usr_${Date.now()}`;
        }
      }
    }

    const safeUid = uid || `usr_${Date.now()}`;
    setUserId(safeUid);

    const fullName = `${form.firstName} ${form.fatherName} ${form.grandfatherName} ${form.familyName}`
      .replace(/\s+/g, ' ')
      .trim();

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
        tribeName: form.tribeName,
        familyBranch: form.branchName,
      }
    );

    let effectiveMode = dashboardStateMode;
    let effectiveMatched = lineageResult.matched;
    let resolvedActiveResult = lineageResult;

    if (selectedDisambiguation === 'option_a' && lineageResult.optionAResultOverride) {
      resolvedActiveResult = {
        ...lineageResult,
        ...lineageResult.optionAResultOverride,
        requiresBlindDisambiguation: false,
      };
      setLineageResult(resolvedActiveResult);
      effectiveMode = DashboardStateMode.State2MatchedUnpaid;
      effectiveMatched = true;
      setDashboardStateMode(DashboardStateMode.State2MatchedUnpaid);
    } else if (selectedDisambiguation === 'option_b' && lineageResult.optionBResultOverride) {
      const nextBase = {
        ...lineageResult,
        ...lineageResult.optionBResultOverride,
        requiresBlindDisambiguation: false,
      };
      resolvedActiveResult = isAlphaMergedIntoAdam
        ? upgradeAlphaResultToMergedAdam(nextBase)
        : nextBase;
      setLineageResult(resolvedActiveResult);
      effectiveMode = DashboardStateMode.State2MatchedUnpaid;
      effectiveMatched = true;
      setDashboardStateMode(DashboardStateMode.State2MatchedUnpaid);
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
      setLineageResult(resolvedActiveResult);
      effectiveMode = DashboardStateMode.State3Unmatched;
      effectiveMatched = false;
      setDashboardStateMode(DashboardStateMode.State3Unmatched);
    }

    let createdTicketNumber =
      resolvedActiveResult.alphaBackgroundTicketCode || 'AUTO-ADAM';
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
        alphaBackgroundTicketCode: resolvedActiveResult.alphaBackgroundTicketCode,
        verifiedSources: resolvedActiveResult.verified_sources,
        corroboratingAlphaEvidence:
          resolvedActiveResult.corroborating_alpha_evidence_for_researcher,
        siblingBranches: resolvedActiveResult.sibling_branches_in_record,
        notablesInRecord: resolvedActiveResult.notables_in_record,
        enrichedLocations: resolvedActiveResult.enrichedLocations,
        adamSpineNodesCount: resolvedActiveResult.adamSpineNodes?.length || 1,
        additionalNotes:
          selectedDisambiguation === 'not_sure_ticket'
            ? lineageResult.disambiguationPathsSummaryForTicket ||
              'طلب تحرٍّ أرشيفي أولي (P1) مفتوح من آلية حسم الشك الثنائية.'
            : undefined,
      });
      createdTicketNumber = syncedTicket.ticketNumber;
    } catch (ticketErr) {
      console.warn('Could not auto-sync research ticket:', ticketErr);
      if (!effectiveMatched || selectedDisambiguation === 'not_sure_ticket') {
        try {
          const t = await createResearchTicket({
            userId: safeUid,
            userFullName: fullName,
            userEmail: email,
            targetAncestor: fullName,
            tribeName: form.tribeName,
            familyBranch: form.branchName,
            originCountry:
              [form.originCountry, form.originRegion].filter(Boolean).join(' - ') ||
              'غير محدد',
            additionalNotes:
              'طلب فحص أرشيفي مفتوح تلقائياً من رحلة الاستكشاف عند عدم وجود تطابق فوري.',
          });
          createdTicketNumber = t.ticketNumber;
        } catch {
          // Ignore
        }
      }
    }

    // Record real customer order in Firebase (/customer_orders) for /Team visibility
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
      walletBalanceUsd: effectiveMode === DashboardStateMode.AnnualVip ? 25 : 0,
      paidRevenueUsd:
        effectiveMode === DashboardStateMode.AnnualVip
          ? 60
          : effectiveMode === DashboardStateMode.State1Paid5Basic
          ? 5
          : 0,
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
    });

    setForm((prev) => ({
      ...prev,
      email,
      password,
      accountType,
      agreedToTerms: true,
    }));

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
      setUserId(user.uid);
      if (user.photoURL) {
        setUserAvatarUrl(user.photoURL);
      }

      const fullName =
        `${form.firstName} ${form.fatherName} ${form.grandfatherName} ${form.familyName}`
          .replace(/\s+/g, ' ')
          .trim() ||
        user.displayName ||
        'مستخدم جذوري';

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
        }
      );

      let ticketNum = lineageResult.alphaBackgroundTicketCode || 'AUTO-GOOGLE';
      try {
        const syncedTicket = await syncClientLineageTicketToFirebase({
          userId: user.uid,
          userFullName: fullName,
          userEmail: user.email || '',
          userPhone: userPhone,
          familyName: lineageResult.familyName || form.familyName,
          originCountry:
            lineageResult.originCountry || form.originCountry || selectedPortalCountry,
          originRegion: lineageResult.originRegion || form.originRegion,
          rootBranchName: lineageResult.rootBranchName || form.branchName,
          rootTribeName: lineageResult.rootTribeName || form.tribeName,
          matched: lineageResult.matched,
          isAlphaOnlyBeforeMerge: lineageResult.isAlphaOnlyBeforeMerge,
          isAlphaMergedIntoAdam: lineageResult.isAlphaMergedIntoAdam,
          adamNodeId: lineageResult.adamNodeId,
          alphaBackgroundTicketCode: lineageResult.alphaBackgroundTicketCode,
          verifiedSources: lineageResult.verified_sources,
          corroboratingAlphaEvidence:
            lineageResult.corroborating_alpha_evidence_for_researcher,
          siblingBranches: lineageResult.sibling_branches_in_record,
          notablesInRecord: lineageResult.notables_in_record,
          enrichedLocations: lineageResult.enrichedLocations,
          adamSpineNodesCount: lineageResult.adamSpineNodes?.length || 1,
        });
        ticketNum = syncedTicket.ticketNumber;
      } catch (ticketErr) {
        console.warn('Ticket sync error:', ticketErr);
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
        legalRole: 'individual',
        accountStatus: 'free',
        walletBalanceUsd: 0,
        paidRevenueUsd: 0,
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
      });

      setForm((prev) => ({
        ...prev,
        email: user.email || prev.email,
        agreedToTerms: true,
      }));

      setHasActiveSession(true);
      setSearchStep(3);
      setPreviousPlatformView('dashboard');
      setActiveView('dashboard');
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (err) {
      console.warn('Google sign-in preservation failed:', err);
    }
  };

  const handleLoginSuccess = async (payload: {
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
  }) => {
    if (payload.uid) {
      setUserId(payload.uid);
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

    const immediateResult = resolveDeterministicLineage({
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

    const targetMode =
      payload.subscriptionTier === 'premium_annual'
        ? DashboardStateMode.AnnualVip
        : payload.subscriptionTier === 'basic_verified' || payload.isRootUnlocked
        ? DashboardStateMode.State1Paid5Basic
        : immediateResult.recommendedInitialState;

    setDashboardStateMode(targetMode);
    setHasActiveSession(true);
    setSearchStep(3);
    setLoginModalOpen(false);
    setPreviousPlatformView('dashboard');
    setActiveView('dashboard');
    window.scrollTo({ top: 0, behavior: 'auto' });

    // Also run full engine search in background to enrich if live Port 8090 responds
    searchJuthoriLineage(updatedForm, {
      ip_country: silentGeo.ip_country,
      ip_city: silentGeo.ip_city,
    })
      .then((liveRes) => {
        setLineageResult(liveRes);
      })
      .catch(() => {});
  };

  const handleLogoutCustomer = () => {
    setHasActiveSession(false);
    setUserId('');
    setUserAvatarUrl('');
    setUserPhone('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    }
    auth.signOut().catch(() => {});
    setForm(DEFAULT_FORM_STATE);
    setSearchStep(1);
    setPreviousPlatformView('landing');
    setActiveView('landing');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
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

  // Update immediate parents (Father & Grandfather) when added inline by the client
  const handleUpdateImmediateParents = (
    nextFatherName: string,
    nextGrandfatherName: string
  ) => {
    const cleanFather = nextFatherName.trim() === '—' ? '' : nextFatherName.trim();
    const cleanGrandfather =
      nextGrandfatherName.trim() === '—' ? '' : nextGrandfatherName.trim();
    setForm((prev) => ({
      ...prev,
      fatherName: cleanFather,
      grandfatherName: cleanGrandfather,
    }));
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

  return (
    <>
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
          isSearching={isSearching}
          searchStep={searchStep}
          onOpenLogin={() => setLoginModalOpen(true)}
          silentGeo={silentGeo}
        />
      ) : activeView === 'searching' ? (
        <SearchProgressScreen
          form={form}
          result={lineageResult}
          onCompletePreservation={handleCompletePreservation}
          onGoogleSignInPreserve={handleGoogleSignInPreserve}
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
