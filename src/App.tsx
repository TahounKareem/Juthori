import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth, googleProvider } from './services/firebase';
import {
  fetchUserProfile,
  createUserProfileIfMissing,
  createResearchTicket,
} from './services/firestoreService';
import {
  AccountLegalType,
  DashboardStateMode,
  LineageSearchResult,
  RegistrationFormState,
  SilentGeoMetadata,
} from './types/juthori';
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

export function App() {
  const [form, setForm] = useState<RegistrationFormState>(DEFAULT_FORM_STATE);
  const [selectedPortalCountry, setSelectedPortalCountry] = useState<string>('السعودية');
  const [silentGeo, setSilentGeo] = useState<SilentGeoMetadata>({
    ip: '127.0.0.1',
    ip_country: 'السعودية',
    ip_country_code: 'SA',
    ip_city: 'الرياض',
    captured_at: new Date().toISOString(),
  });

  const [isSearching, setIsSearching] = useState(false);
  const [searchStep, setSearchStep] = useState<1 | 2 | 3>(1);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const [activeView, setActiveView] = useState<
    'landing' | 'searching' | 'dashboard' | 'staff_portal'
  >(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1' || params.get('view') === 'dashboard') {
        return 'dashboard';
      }
      if (
        params.get('view') === 'researcher' ||
        params.get('view') === 'staff' ||
        params.get('view') === 'admin'
      ) {
        return 'staff_portal';
      }
    }
    return 'landing';
  });

  const [previousPlatformView, setPreviousPlatformView] = useState<
    'landing' | 'dashboard'
  >('landing');

  const [isAlphaMergedIntoAdam, setIsAlphaMergedIntoAdam] = useState(false);

  const [lineageResult, setLineageResult] = useState<LineageSearchResult>(() =>
    resolveDeterministicLineage(DEFAULT_DEMO_SEED)
  );
  const [dashboardStateMode, setDashboardStateMode] = useState<DashboardStateMode>(
    DashboardStateMode.State2MatchedUnpaid
  );

  // Silent IP Geolocation Capture in background
  useEffect(() => {
    let active = true;
    fetch('/api/juthori/geo')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data && data.ip_country) {
          setSilentGeo(data);
        }
      })
      .catch(() => {
        // Silent fallback already initialized in state
      });

    return () => {
      active = false;
    };
  }, []);

  // Firebase Auth Observer to synchronize logged-in user profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const profile = await fetchUserProfile(user.uid);
          if (profile) {
            const nameParts = (profile.fullName || user.displayName || '').split(' ');
            setForm((prev) => ({
              ...prev,
              email: profile.email || user.email || prev.email,
              firstName: nameParts[0] || prev.firstName,
              fatherName: nameParts[1] || prev.fatherName,
              grandfatherName: nameParts[2] || prev.grandfatherName,
              familyName: nameParts.slice(3).join(' ') || prev.familyName,
              tribeName: profile.tribeName || prev.tribeName,
              branchName: profile.familyBranch || prev.branchName,
              originCountry: profile.originCountry || prev.originCountry,
              accountType:
                profile.accountType === 'record_keeper'
                  ? AccountLegalType.RecordKeeper
                  : AccountLegalType.Individual,
            }));
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

    const rawResult = await searchJuthoriLineage(form, {
      ip_country: silentGeo.ip_country,
      ip_city: silentGeo.ip_city,
    });

    const finalResult =
      rawResult.isAlphaOnlyBeforeMerge && isAlphaMergedIntoAdam
        ? upgradeAlphaResultToMergedAdam(rawResult)
        : rawResult;

    setLineageResult(finalResult);
    setDashboardStateMode(finalResult.recommendedInitialState);
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
    let uid = auth.currentUser?.uid;
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

    const fullName = `${form.firstName} ${form.fatherName} ${form.grandfatherName} ${form.familyName}`
      .replace(/\s+/g, ' ')
      .trim();

    await createUserProfileIfMissing(
      { uid: uid || `usr_${Date.now()}`, email, displayName: fullName },
      {
        fullName,
        email,
        accountType,
        originCountry: form.originCountry,
        tribeName: form.tribeName,
        familyBranch: form.branchName,
      }
    );

    if (selectedDisambiguation === 'option_a' && lineageResult.optionAResultOverride) {
      setLineageResult((prev) => ({
        ...prev,
        ...prev.optionAResultOverride,
        requiresBlindDisambiguation: false,
      }));
      setDashboardStateMode(DashboardStateMode.State2MatchedUnpaid);
    } else if (selectedDisambiguation === 'option_b' && lineageResult.optionBResultOverride) {
      setLineageResult((prev) => {
        const nextBase = {
          ...prev,
          ...prev.optionBResultOverride,
          requiresBlindDisambiguation: false,
        };
        return isAlphaMergedIntoAdam
          ? upgradeAlphaResultToMergedAdam(nextBase)
          : nextBase;
      });
      setDashboardStateMode(DashboardStateMode.State2MatchedUnpaid);
    } else if (selectedDisambiguation === 'not_sure_ticket') {
      setDashboardStateMode(DashboardStateMode.State3Unmatched);
    }

    if (!lineageResult.matched || selectedDisambiguation === 'not_sure_ticket') {
      try {
        await createResearchTicket({
          userId: uid || `usr_${Date.now()}`,
          userFullName: fullName,
          userEmail: email,
          targetAncestor: fullName,
          tribeName: form.tribeName,
          familyBranch: form.branchName,
          originCountry:
            [form.originCountry, form.originRegion].filter(Boolean).join(' - ') ||
            'غير محدد',
          additionalNotes:
            selectedDisambiguation === 'not_sure_ticket'
              ? lineageResult.disambiguationPathsSummaryForTicket ||
                'طلب تحرٍّ أرشيفي أولي (P1) مفتوح من آلية حسم الشك الثنائية.'
              : 'طلب فحص أرشيفي مفتوح تلقائياً من رحلة الاستكشاف عند عدم وجود تطابق فوري.',
        });
      } catch (ticketErr) {
        console.warn('Could not auto-open research ticket:', ticketErr);
      }
    }

    setForm((prev) => ({
      ...prev,
      email,
      password,
      accountType,
      agreedToTerms: true,
    }));

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
      const fullName =
        `${form.firstName} ${form.fatherName} ${form.grandfatherName} ${form.familyName}`
          .replace(/\s+/g, ' ')
          .trim() || (user.displayName || 'مستخدم جذوري');

      await createUserProfileIfMissing(
        { uid: user.uid, email: user.email, displayName: user.displayName || fullName },
        {
          fullName,
          email: user.email || 'user@juthori.com',
          accountType: form.accountType,
          originCountry: form.originCountry,
          tribeName: form.tribeName,
          familyBranch: form.branchName,
        }
      );

      if (!lineageResult.matched) {
        try {
          await createResearchTicket({
            userId: user.uid,
            userFullName: fullName,
            userEmail: user.email || '',
            targetAncestor: fullName,
            tribeName: form.tribeName,
            familyBranch: form.branchName,
            originCountry: form.originCountry,
            additionalNotes: 'طلب فحص أرشيفي مفتوح تلقائياً عبر تسجيل الدخول السريع بحساب Google.',
          });
        } catch (ticketErr) {
          console.warn('Ticket error:', ticketErr);
        }
      }

      setForm((prev) => ({
        ...prev,
        email: user.email || prev.email,
        agreedToTerms: true,
      }));

      setSearchStep(3);
      setPreviousPlatformView('dashboard');
      setActiveView('dashboard');
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (err) {
      console.warn('Google sign-in preservation failed:', err);
    }
  };

  const handleLoginSuccess = async (payload: {
    email: string;
    firstName: string;
    fatherName: string;
    grandfatherName: string;
    familyName: string;
    originCountry: string;
    tribeName: string;
    branchName: string;
    accountType: AccountLegalType;
  }) => {
    setForm((prev) => ({
      ...prev,
      ...payload,
      agreedToTerms: true,
    }));
    const result = resolveDeterministicLineage(payload);
    setLineageResult(result);
    setDashboardStateMode(result.recommendedInitialState);
    setSearchStep(3);
    setLoginModalOpen(false);
    setPreviousPlatformView('dashboard');
    setActiveView('dashboard');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // Live Researcher Studio Callback inside Staff Portal: Merge Alpha nodes (الابو حليحل / الابو معيط -> خابور -> العقيدات) into Adam's Tree
  const handleApproveAlphaMergeIntoAdam = ({
    familyName,
  }: {
    familyName: string;
    subRootName: string;
    motherTribeName: string;
    approveSources: boolean;
  }) => {
    setIsAlphaMergedIntoAdam(true);
    setLineageResult((prev) => {
      if (
        prev.isAlphaOnlyBeforeMerge ||
        prev.isAlphaMergedIntoAdam ||
        prev.familyName.includes('حليحل') ||
        prev.familyName.includes('معيط') ||
        prev.familyName.includes('خابور')
      ) {
        return upgradeAlphaResultToMergedAdam(prev);
      }
      const resolved = resolveDeterministicLineage({
        firstName: form.firstName || 'كريم',
        fatherName: form.fatherName || '',
        grandfatherName: form.grandfatherName || '',
        familyName: familyName || 'الابو معيط',
        originCountry: 'سوريا',
        originRegion: 'دير الزور',
        tribeName: 'العقيدات',
        branchName: 'خابور',
      });
      return upgradeAlphaResultToMergedAdam(resolved);
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
    setForm((prev) => ({
      ...prev,
      fatherName: nextFatherName,
      grandfatherName: nextGrandfatherName,
    }));
    setLineageResult((prev) => ({
      ...prev,
      fatherName: nextFatherName || '—',
      grandfatherName: nextGrandfatherName || '—',
    }));
  };

  return (
    <>
      {activeView === 'staff_portal' ? (
        <AdminStaffPortal
          currentClientResult={lineageResult}
          currentClientStateMode={dashboardStateMode}
          currentClientAccountType={form.accountType}
          currentClientEmail={form.email || DEFAULT_DEMO_SEED.email}
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
            setActiveView(previousPlatformView);
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          }}
        />
      ) : activeView === 'landing' ? (
        <LandingPage
          form={form}
          onChangeForm={setForm}
          selectedPortalCountry={selectedPortalCountry}
          onSelectPortalCountry={setSelectedPortalCountry}
          onSubmitSearch={handleSubmitSearch}
          isSearching={isSearching}
          searchStep={searchStep}
          onOpenLogin={() => setLoginModalOpen(true)}
          onOpenStaffPortal={() => {
            setPreviousPlatformView('landing');
            setActiveView('staff_portal');
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
          onUpgradeAccountToRecordKeeper={() =>
            setForm((prev) => ({
              ...prev,
              accountType: AccountLegalType.RecordKeeper,
            }))
          }
          onToggleAccountTypeForTest={(nextRole) =>
            setForm((prev) => ({
              ...prev,
              accountType: nextRole,
            }))
          }
          result={lineageResult}
          silentGeo={silentGeo}
          userEmail={form.email || DEFAULT_DEMO_SEED.email}
          onBackToLanding={() => {
            setSearchStep(1);
            setPreviousPlatformView('landing');
            setActiveView('landing');
            window.scrollTo({ top: 0, behavior: 'auto' });
          }}
          onOpenStaffPortal={() => {
            setPreviousPlatformView('dashboard');
            setActiveView('staff_portal');
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          }}
          onUpdateImmediateParents={handleUpdateImmediateParents}
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
