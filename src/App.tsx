import { useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
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
  isEmailPrefixOrAsciiPlaceholder,
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
  normalizeArabicForSearch,
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
      if (
        em === 'hassan.almuqit@juthori.com' ||
        em === 'kareem.tahoun@adamresearchcenter.net' ||
        em === 'client@juthori.com'
      ) {
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
    () => initialSession?.lineageResult || resolveDeterministicLineage(DEFAULT_UNAUTHENTICATED_SEED)
  );
  const [dashboardStateMode, setDashboardStateMode] = useState<DashboardStateMode>(
    () => initialSession?.dashboardStateMode || DashboardStateMode.State2MatchedUnpaid
  );

  // Refs to preserve active Arabic search form & matched lineageResult during Firebase Auth callbacks
  const formRef = useRef<RegistrationFormState>(form);
  const lineageResultRef = useRef<LineageSearchResult>(lineageResult);
  useEffect(() => {
    formRef.current = form;
  }, [form]);
  useEffect(() => {
    lineageResultRef.current = lineageResult;
  }, [lineageResult]);

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
        const [byUid, byEmail] = await Promise.all([
          cachedUid ? fetchUserProfile(cachedUid) : Promise.resolve(null),
          cachedEmail ? fetchUserProfileByEmail(cachedEmail) : Promise.resolve(null),
        ]);
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

  // Firebase Auth Observer to synchronize logged-in user profile and keep customer session active
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Ignore anonymous sessions or team/admin service accounts on customer frontend
        const cleanUserEmail = (user.email || '').trim().toLowerCase();
        if (
          user.isAnonymous ||
          cleanUserEmail === 'kareem.tahoun@adamresearchcenter.net'
        ) {
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

        setUserId(user.uid);
        try {
          const activeSearchForm = formRef.current;
          const activeLineage = lineageResultRef.current;
          const hasActiveArabicSearch =
            Boolean(activeSearchForm.familyName) &&
            !isEmailPrefixOrAsciiPlaceholder(
              activeSearchForm.familyName,
              cleanUserEmail
            );

          const [profileByUid, profileByEmail] = await Promise.all([
            fetchUserProfile(user.uid),
            user.email ? fetchUserProfileByEmail(user.email) : Promise.resolve(null),
          ]);
          let profile =
            (profileByEmail?.familyName &&
            !isEmailPrefixOrAsciiPlaceholder(profileByEmail.familyName, cleanUserEmail)
              ? profileByEmail
              : null) ||
            (profileByUid?.familyName &&
            !isEmailPrefixOrAsciiPlaceholder(profileByUid.familyName, cleanUserEmail)
              ? profileByUid
              : null) ||
            profileByEmail ||
            profileByUid;

          const localEmailPart = (cleanUserEmail.split('@')[0] || '').toLowerCase();
          const isTahounKareem =
            localEmailPart.includes('tahoun') && localEmailPart.includes('kareem');
          const isSnosiEmail =
            cleanUserEmail === 'snosi@gmail.com' || localEmailPart === 'snosi';

          if (!profile) {
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
                accountType:
                  activeSearchForm.accountType === AccountLegalType.RecordKeeper
                    ? 'record_keeper'
                    : 'individual',
              }
            );
          } else if (
            hasActiveArabicSearch &&
            (isEmailPrefixOrAsciiPlaceholder(profile.familyName, cleanUserEmail) ||
              isEmailPrefixOrAsciiPlaceholder(profile.firstName, cleanUserEmail) ||
              normalizeArabicForSearch(profile.familyName || '') !==
                normalizeArabicForSearch(activeSearchForm.familyName || ''))
          ) {
            // Fix 1(b): Immediately heal/update existing profile in Firestore with the active Arabic search data!
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
              activeSearchForm.originCountry ||
              profile.originCountry ||
              (isSnosiEmail ? 'مصر' : 'السعودية');
            const resolvedRegion =
              activeSearchForm.originRegion ||
              profile.originRegion ||
              (isSnosiEmail ? 'مغاغة' : '');
            const resolvedTribe =
              activeSearchForm.tribeName || profile.tribeName || '';
            const resolvedBranch =
              activeSearchForm.branchName || profile.familyBranch || '';
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
              // Preserve existing matched lineageResult if it already matches the same Arabic family!
              const alreadyHasMatchedLineageForFamily =
                Boolean(activeLineage?.matched) &&
                normalizeArabicForSearch(activeLineage.familyName) ===
                  normalizeArabicForSearch(resolvedFamily);

              const baseLineage = alreadyHasMatchedLineageForFamily
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
                  });

              setLineageResult(baseLineage);

              if (profile.subscriptionTier === 'premium_annual') {
                setDashboardStateMode(DashboardStateMode.AnnualVip);
              } else if (
                profile.subscriptionTier === 'basic_verified' ||
                profile.isRootUnlocked
              ) {
                setDashboardStateMode(DashboardStateMode.State1Paid5Basic);
              } else {
                setDashboardStateMode(
                  baseLineage.matched
                    ? DashboardStateMode.State2MatchedUnpaid
                    : baseLineage.recommendedInitialState
                );
              }

              // Also fetch from Live German Engine in background while honoring saved verification answer
              searchJuthoriLineage(nextForm, {
                ip_country: silentGeo.ip_country,
                ip_city: silentGeo.ip_city,
              })
                .then((liveRes) => {
                  if (liveRes && liveRes.matched) {
                    const mergedLive: LineageSearchResult = {
                      ...liveRes,
                      clientName: resolvedFirst || liveRes.clientName,
                      fatherName: resolvedFather || liveRes.fatherName,
                      grandfatherName: resolvedGrand || liveRes.grandfatherName,
                      requiresBlindDisambiguation:
                        resolvedTribe || resolvedBranch
                          ? false
                          : liveRes.requiresBlindDisambiguation,
                    };
                    setLineageResult(mergedLive);
                    setDashboardStateMode((currMode) =>
                      currMode === DashboardStateMode.State3Unmatched
                        ? DashboardStateMode.State2MatchedUnpaid
                        : currMode
                    );
                  }
                })
                .catch(() => {});
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
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        uid = cred.user.uid;
        sendEmailVerification(cred.user).catch(() => {});
      } catch {
        try {
          const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
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
    } else if (
      effectiveMatched &&
      effectiveMode === DashboardStateMode.State3Unmatched
    ) {
      effectiveMode = DashboardStateMode.State2MatchedUnpaid;
      setDashboardStateMode(DashboardStateMode.State2MatchedUnpaid);
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

    let createdTicketNumber =
      resolvedActiveResult.alphaBackgroundTicketCode || '—';
    // Fix 3: Only create an active research ticket on registration if the customer chose "not_sure_ticket" (escalated)
    // or if they are an Annual VIP subscriber!
    if (
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
              : undefined,
        });
        if (syncedTicket) {
          createdTicketNumber = syncedTicket.ticketNumber;
        }
      } catch (ticketErr) {
        console.warn('Could not auto-sync research ticket:', ticketErr);
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

      const ticketNum = lineageResult.alphaBackgroundTicketCode || '—';

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
        : immediateResult.matched
        ? DashboardStateMode.State2MatchedUnpaid
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
        if (liveRes.matched) {
          setDashboardStateMode((currMode) =>
            currMode === DashboardStateMode.State3Unmatched
              ? DashboardStateMode.State2MatchedUnpaid
              : currMode
          );
        }
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
