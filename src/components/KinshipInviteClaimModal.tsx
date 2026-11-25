import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Globe,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import {
  auth,
  googleProvider,
  mirrorAuth,
} from '../services/firebase';
import { TERMS_AND_PRIVACY_VERSION } from '../data/recordKeeperContractData';
import {
  ARAB_COUNTRIES_22,
  GENERAL_DIASPORA_COUNTRY_INFO,
} from '../data/arabCountries';
import {
  buildVerifiedLineageSnapshot,
  createUserProfileIfMissing,
  recordLegalAuditTrailInFirebase,
  updateUserProfile,
} from '../services/firestoreService';
import {
  KinshipInvitationDoc,
  claimKinshipInvitation,
  processKinshipOptOutByToken,
} from '../services/priority4Service';
import { clearPendingInviteToken } from '../config/referralAndSiteConfig';
import { resolveDeterministicLineage } from '../utils/lineageEngine';
import type { LineageSearchResult } from '../types/juthori';

const ORIGIN_COUNTRY_OPTIONS: string[] = [
  ...ARAB_COUNTRIES_22.map((c) => c.name),
  GENERAL_DIASPORA_COUNTRY_INFO.name,
];

export interface ClaimedKinshipSessionPayload {
  uid: string;
  email: string;
  firstName: string;
  fullName: string;
  kinshipRelation: string;
  familyName: string;
  originCountry: string;
  originRegion: string;
  fatherName: string;
  grandfatherName: string;
  tribeName: string;
  branchName: string;
  phone: string;
  residenceCountry: string;
  residenceCity: string;
  profession: string;
  subscriptionTier: 'free' | 'basic_5' | 'annual_vip';
  isRootUnlocked: boolean;
  matchedLineage: LineageSearchResult;
  invitation: KinshipInvitationDoc;
}

interface KinshipInviteClaimModalProps {
  isOpen: boolean;
  invitation: KinshipInvitationDoc;
  onClose: () => void;
  onClaimCompleted: (payload: ClaimedKinshipSessionPayload) => void;
  onOptOutCompleted?: (messageAr: string) => void;
}

function splitInitialRelativeName(raw: string): {
  first: string;
  father: string;
  grandfather: string;
} {
  const parts = (raw || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    first: parts[0] || '',
    father: parts[1] || '',
    grandfather: parts[2] || '',
  };
}

export const KinshipInviteClaimModal: React.FC<
  KinshipInviteClaimModalProps
> = ({
  isOpen,
  invitation,
  onClose,
  onClaimCompleted,
  onOptOutCompleted,
}) => {
  const parsedInitial = splitInitialRelativeName(invitation.relativeName || '');

  const [authMode, setAuthMode] = useState<'claim_new' | 'sign_in_existing'>(
    'claim_new'
  );
  const [firstName, setFirstName] = useState(parsedInitial.first);
  const [fatherName, setFatherName] = useState(
    invitation.fatherName || parsedInitial.father
  );
  const [grandfatherName, setGrandfatherName] = useState(
    invitation.grandfatherName || parsedInitial.grandfather
  );
  const [familyName, setFamilyName] = useState(invitation.familyName || '');
  const [originCountry, setOriginCountry] = useState(
    invitation.originCountry && ORIGIN_COUNTRY_OPTIONS.includes(invitation.originCountry)
      ? invitation.originCountry
      : 'السعودية'
  );
  const [originRegion, setOriginRegion] = useState(
    invitation.originRegion || invitation.residenceCity || ''
  );

  // Collapsible extra lineage data
  const [showExtraLineage, setShowExtraLineage] = useState(false);
  const [tribeName, setTribeName] = useState(invitation.tribeName || '');
  const [branchName, setBranchName] = useState(invitation.familyBranch || '');

  // Account credentials
  const [email] = useState((invitation.invitedEmail || '').trim().toLowerCase());
  const [phone, setPhone] = useState(invitation.phone || '');
  const [password, setPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [optingOut, setOptingOut] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const split = splitInitialRelativeName(invitation.relativeName || '');
    setFirstName(split.first);
    setFatherName(invitation.fatherName || split.father);
    setGrandfatherName(invitation.grandfatherName || split.grandfather);
    setFamilyName(invitation.familyName || '');
    setOriginCountry(
      invitation.originCountry && ORIGIN_COUNTRY_OPTIONS.includes(invitation.originCountry)
        ? invitation.originCountry
        : 'السعودية'
    );
    setOriginRegion(invitation.originRegion || invitation.residenceCity || '');
    setTribeName(invitation.tribeName || '');
    setBranchName(invitation.familyBranch || '');
    setPhone(invitation.phone || '');
  }, [invitation]);

  if (!isOpen) return null;

  const finalizeClaimForAuthenticatedUser = async (firebaseUser: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
  }) => {
    const cleanFirst =
      firstName.trim() ||
      splitInitialRelativeName(invitation.relativeName || '').first ||
      'عضو';
    const cleanFather = fatherName.trim();
    const cleanGrand = grandfatherName.trim();
    const cleanFamily = (familyName.trim() || invitation.familyName || 'العائلة').trim();
    const cleanCountry = originCountry.trim() || invitation.originCountry || 'السعودية';
    const cleanRegion = originRegion.trim();
    const cleanTribe = tribeName.trim();
    const cleanBranch = branchName.trim();
    const cleanPhone = phone.trim();

    const composedFullName = [
      cleanFirst,
      cleanFather,
      cleanGrand,
      cleanFamily,
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 140);

    // Silent deterministic background lineage search (NEVER unlocks root for free!)
    const matchedLineage = resolveDeterministicLineage({
      firstName: cleanFirst,
      fatherName: cleanFather,
      grandfatherName: cleanGrand,
      familyName: cleanFamily,
      originCountry: cleanCountry,
      originRegion: cleanRegion,
      tribeName: cleanTribe,
      branchName: cleanBranch,
    });
    const lineageSnapshot = buildVerifiedLineageSnapshot(matchedLineage);

    const authEmailLower = (firebaseUser.email || email).trim().toLowerCase();
    const invitedEmailLower = (invitation.invitedEmail || '')
      .trim()
      .toLowerCase();
    const isAutoVerifiedByInviteToken =
      Boolean(authEmailLower) && authEmailLower === invitedEmailLower;
    const nowIso = new Date().toISOString();

    const ensuredProfile = await createUserProfileIfMissing(
      firebaseUser,
      {
        email: authEmailLower,
        fullName: composedFullName,
        firstName: cleanFirst,
        fatherName: cleanFather,
        grandfatherName: cleanGrand,
        familyName: cleanFamily,
        originCountry: cleanCountry,
        originRegion: cleanRegion,
        tribeName: cleanTribe || undefined,
        familyBranch: cleanBranch || undefined,
        phone: cleanPhone || undefined,
        defaultCountry: cleanCountry,
        residenceCity: cleanRegion || undefined,
        accountType: 'individual',
        subscriptionTier: 'free',
        isRootUnlocked: false,
        verifiedLineageSnapshot: lineageSnapshot,
        lineageSnapshot,
        agreedToTermsAndPrivacy: true,
        termsAndPrivacyAgreedAt: nowIso,
        emailVerified: isAutoVerifiedByInviteToken ? true : undefined,
        emailVerifiedAt: isAutoVerifiedByInviteToken ? nowIso : undefined,
        referredByUserId: invitation.ownerId,
        referredByCode: invitation.referralCode,
      },
      { skipTeamCheck: false }
    );

    // Preserve existing paid tier ONLY if user explicitly signed into an already-paid account
    const existingTierRaw = String(ensuredProfile.subscriptionTier || 'free').toLowerCase();
    const existingPaidRev =
      typeof ensuredProfile.paidRevenueUsd === 'number'
        ? ensuredProfile.paidRevenueUsd
        : 0;
    const isAlreadyPaidVip =
      existingTierRaw === 'annual_vip' ||
      existingTierRaw === 'premium_annual' ||
      existingTierRaw === 'premium_monthly' ||
      existingTierRaw === 'lifetime_patron' ||
      existingPaidRev >= 55;
    const isAlreadyPaidBasic =
      Boolean(ensuredProfile.isRootUnlocked) ||
      existingTierRaw === 'basic_verified' ||
      existingTierRaw === 'basic_5' ||
      existingTierRaw === 'basic_root' ||
      existingPaidRev >= 5;

    const effectiveSubscriptionTier: 'free' | 'basic_5' | 'annual_vip' =
      isAlreadyPaidVip
        ? 'annual_vip'
        : isAlreadyPaidBasic
        ? 'basic_5'
        : 'free';
    const effectiveIsRootUnlocked = isAlreadyPaidVip || isAlreadyPaidBasic;

    await updateUserProfile(firebaseUser.uid, {
      fullName: composedFullName,
      firstName: cleanFirst,
      fatherName: cleanFather || ensuredProfile.fatherName || undefined,
      grandfatherName: cleanGrand || ensuredProfile.grandfatherName || undefined,
      familyName: cleanFamily,
      originCountry: cleanCountry,
      originRegion: cleanRegion || ensuredProfile.originRegion || '',
      tribeName: cleanTribe || ensuredProfile.tribeName || undefined,
      familyBranch: cleanBranch || ensuredProfile.familyBranch || undefined,
      phone: cleanPhone || ensuredProfile.phone || undefined,
      defaultCountry: cleanCountry,
      residenceCity: cleanRegion || ensuredProfile.residenceCity || undefined,
      verifiedLineageSnapshot: lineageSnapshot,
      lineageSnapshot,
      ...(!effectiveIsRootUnlocked
        ? { subscriptionTier: 'free', isRootUnlocked: false }
        : {}),
      emailVerified: isAutoVerifiedByInviteToken
        ? true
        : ensuredProfile.emailVerified,
      emailVerifiedAt: isAutoVerifiedByInviteToken
        ? ensuredProfile.emailVerifiedAt || nowIso
        : ensuredProfile.emailVerifiedAt,
    }).catch(() => {});

    const updatedInvite =
      (await claimKinshipInvitation({
        inviteToken: invitation.inviteToken,
        claimedByUid: firebaseUser.uid,
        relativeName: composedFullName,
        familyName: cleanFamily,
        fatherName: cleanFather || undefined,
        grandfatherName: cleanGrand || undefined,
        originCountry: cleanCountry || undefined,
        originRegion: cleanRegion || undefined,
        tribeName: cleanTribe || undefined,
        familyBranch: cleanBranch || undefined,
        phone: cleanPhone || undefined,
        residenceCountry: cleanCountry || undefined,
        residenceCity: cleanRegion || undefined,
      })) || invitation;

    recordLegalAuditTrailInFirebase({
      userId: firebaseUser.uid,
      userFullName: composedFullName,
      familyName: cleanFamily,
      userEmail: authEmailLower,
      eventType: 'ACCOUNT_REGISTRATION_CONSENT',
      documentTitle:
        'تفعيل عضوية دائرة العائلة الخاصة والموافقة على شروط الاستخدام والخصوصية',
      documentVersion: TERMS_AND_PRIVACY_VERSION,
      consentStatement:
        'أوافق على شروط الاستخدام وسياسة الخصوصية في منصة جذوري وتفعيل عضويتي في الدائرة العائلية الخاصة.',
      verificationMethod: 'Kinship Invitation Token Claim (Verified Email)',
    }).catch(() => {});

    clearPendingInviteToken();
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url.pathname + url.search);
      } catch {
        // Ignore URL replace errors
      }
    }

    onClaimCompleted({
      uid: firebaseUser.uid,
      email: authEmailLower,
      firstName: cleanFirst,
      fullName: composedFullName,
      kinshipRelation: invitation.kinshipRelation,
      familyName: cleanFamily,
      originCountry: cleanCountry,
      originRegion: cleanRegion,
      fatherName: cleanFather,
      grandfatherName: cleanGrand,
      tribeName: cleanTribe,
      branchName: cleanBranch,
      phone: cleanPhone,
      residenceCountry: cleanCountry,
      residenceCity: cleanRegion,
      profession: '',
      subscriptionTier: effectiveSubscriptionTier,
      isRootUnlocked: effectiveIsRootUnlocked,
      matchedLineage,
      invitation: updatedInvite,
    });
  };

  const handlePasswordClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (authMode === 'claim_new') {
      if (!firstName.trim()) {
        setErrorMsg('يرجى كتابة الاسم الأول للمتابعة.');
        return;
      }
      if (!fatherName.trim()) {
        setErrorMsg('يرجى كتابة اسم الأب لتكوين سجل النسب بشكل صحيح.');
        return;
      }
      if (!familyName.trim()) {
        setErrorMsg('يرجى كتابة اسم العائلة.');
        return;
      }
    }

    if (!password || password.length < 6) {
      setErrorMsg('يرجى إدخال كلمة مرور لا تقل عن 6 أحرف لتأمين حسابك العائلي.');
      return;
    }

    const syncMirrorSession = (targetEmail: string, targetPass: string) => {
      signInWithEmailAndPassword(mirrorAuth, targetEmail, targetPass).catch(
        () => {
          createUserWithEmailAndPassword(
            mirrorAuth,
            targetEmail,
            targetPass
          ).catch(() => {});
        }
      );
    };

    setSubmitting(true);
    try {
      if (authMode === 'sign_in_existing') {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        syncMirrorSession(email, password);
        await finalizeClaimForAuthenticatedUser(cred.user);
        return;
      }

      try {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const displayFull = [firstName.trim(), fatherName.trim(), familyName.trim()]
          .filter(Boolean)
          .join(' ');
        if (displayFull) {
          await updateProfile(cred.user, {
            displayName: displayFull,
          }).catch(() => {});
        }
        syncMirrorSession(email, password);
        await finalizeClaimForAuthenticatedUser(cred.user);
      } catch (createErr: unknown) {
        const code = (createErr as { code?: string })?.code || '';
        if (code === 'auth/email-already-in-use') {
          try {
            const existingCred = await signInWithEmailAndPassword(
              auth,
              email,
              password
            );
            syncMirrorSession(email, password);
            await finalizeClaimForAuthenticatedUser(existingCred.user);
            return;
          } catch {
            setAuthMode('sign_in_existing');
            setErrorMsg(
              'بريدك الإلكتروني مسجّل مسبقاً في منصة جذوري — يرجى إدخال كلمة مرورك الحالية لتفعيل صلاحية دخول بوابة العائلة فوراً.'
            );
            return;
          }
        }
        throw createErr;
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential'
      ) {
        setErrorMsg(
          'كلمة المرور غير مطابقة لحسابك المسجّل بهذا البريد. يرجى التأكد من كلمة المرور أو المتابعة عبر Google.'
        );
      } else {
        setErrorMsg(
          'تعذّر إتمام التفعيل حالياً. يرجى التحقق من البيانات والمحاولة مرة أخرى.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleClaim = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await finalizeClaimForAuthenticatedUser(cred.user);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code !== 'auth/popup-closed-by-user') {
        setErrorMsg(
          'تعذّرت المتابعة عبر Google في هذه النافذة، يمكنك تعيين كلمة مرور سريعة بالأسفل للتفعيل الفوري.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleInstantOptOut = async () => {
    setOptingOut(true);
    setErrorMsg(null);
    try {
      const res = await processKinshipOptOutByToken(invitation.inviteToken);
      clearPendingInviteToken();
      if (onOptOutCompleted) {
        onOptOutCompleted(res.messageAr);
      } else {
        onClose();
      }
    } finally {
      setOptingOut(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-[#1F1F1C]/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-[#F5F1E8] text-[#1F1F1C] border border-[#D97757]/65 shadow-2xl overflow-hidden my-6">
        {/* Warm Heritage Header */}
        <div className="bg-[#E8DED2] text-[#1F1F1C] px-6 py-5 border-b border-[#D8C7B2] relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 p-1.5 rounded-lg text-[#1F1F1C]/65 hover:text-[#1F1F1C] hover:bg-[#D8C7B2]/50 cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-xs font-bold text-[#D97757] mb-2">
            <Sparkles className="w-4 h-4 text-[#D97757]" />
            <span>دعوة صلة رحم موثّقة · الدائرة العائلية الخاصة</span>
          </div>

          <h2 className="text-lg sm:text-xl font-display font-bold leading-relaxed pl-8 text-[#1F1F1C]">
            مرحباً بك يا {invitation.relativeName} ({invitation.kinshipRelation}) في ديوان وبوابة عائلة {invitation.familyName} — بدعوة كريمة من أمين السجل {invitation.inviterName}
          </h2>

          <p className="text-xs text-[#1F1F1C]/75 mt-2 leading-relaxed">
            أكمل بياناتك النسبية وحسابك في جذوري لفتح الديوان والشجرة المشتركة لعائلة {invitation.familyName} مجاناً، مع تأسيس ملفك الشخصي الخاص والمستقل في المنصة.
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="rounded-xl bg-[#1F1F1C]/10 border border-[#1F1F1C]/35 px-4 py-3 text-xs font-semibold text-[#1F1F1C]">
              {errorMsg}
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex items-center justify-between gap-2 bg-[#E8DED2] p-1 rounded-xl border border-[#D97757]/35">
            <button
              type="button"
              onClick={() => {
                setAuthMode('claim_new');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-display font-bold transition-colors cursor-pointer ${
                authMode === 'claim_new'
                  ? 'bg-[#D97757] text-[#F5F1E8]'
                  : 'text-[#1F1F1C]/75 hover:text-[#1F1F1C]'
              }`}
            >
              إنشاء حسابي وتفعيل الدعوة
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('sign_in_existing');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-display font-bold transition-colors cursor-pointer ${
                authMode === 'sign_in_existing'
                  ? 'bg-[#D97757] text-[#F5F1E8]'
                  : 'text-[#1F1F1C]/75 hover:text-[#1F1F1C]'
              }`}
            >
              لدي حساب سابق في جذوري
            </button>
          </div>

          <form onSubmit={handlePasswordClaimSubmit} className="space-y-4">
            {/* Standard Juthori Registration & Lineage Fields */}
            {authMode === 'claim_new' && (
              <div className="space-y-3.5 rounded-2xl bg-[#F5F1E8]/85 border border-[#D97757]/40 p-4">
                <div className="flex items-center gap-2 text-xs font-display font-bold text-[#D97757]">
                  <Users className="w-4 h-4 text-[#D97757]" />
                  <span>البيانات الشخصية والنسبية (موحدة مع سجل جذوري)</span>
                </div>

                {/* Row 1: First Name | Father Name | Grandfather Name */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1F1F1C] mb-1">
                      الاسم الأول *
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="مثال: أحمد"
                      className="w-full px-3 py-2 rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 text-xs font-semibold text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1F1F1C] mb-1">
                      اسم الأب *
                    </label>
                    <input
                      type="text"
                      required
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                      placeholder="مثال: محمد"
                      className="w-full px-3 py-2 rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 text-xs font-semibold text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1F1F1C] mb-1">
                      اسم الجد
                    </label>
                    <input
                      type="text"
                      value={grandfatherName}
                      onChange={(e) => setGrandfatherName(e.target.value)}
                      placeholder="مثال: عبدالله"
                      className="w-full px-3 py-2 rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 text-xs font-semibold text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                    />
                  </div>
                </div>

                {/* Row 2: Family Name | Country */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1F1F1C] mb-1">
                      اسم العائلة *
                    </label>
                    <input
                      type="text"
                      required
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      placeholder="اسم العائلة أو اللقب"
                      className="w-full px-3 py-2 rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 text-xs font-semibold text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1F1F1C] mb-1">
                      الدولة *
                    </label>
                    <div className="relative">
                      <Globe className="w-3.5 h-3.5 text-[#D97757] absolute right-3 top-2.5 pointer-events-none" />
                      <select
                        required
                        value={originCountry}
                        onChange={(e) => setOriginCountry(e.target.value)}
                        className="w-full pr-8 pl-3 py-2 rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 text-xs font-semibold text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                      >
                        {ORIGIN_COUNTRY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Row 3: Original Homeland / City */}
                <div>
                  <label className="block text-xs font-bold text-[#1F1F1C] mb-1">
                    الموطن الأصلي
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-[#D97757] absolute right-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={originRegion}
                      onChange={(e) => setOriginRegion(e.target.value)}
                      placeholder="المدينة أو المحافظة أو الإقليم الأصلي للعائلة"
                      className="w-full pr-8 pl-3 py-2 rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 text-xs font-semibold text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                    />
                  </div>
                </div>

                {/* Collapsible Extra Lineage Details */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowExtraLineage((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-display font-bold text-[#D97757] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>بيانات نسبية إضافية (القبيلة والفرع)</span>
                    {showExtraLineage ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {showExtraLineage && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[#1F1F1C]/85 mb-1">
                          القبيلة
                        </label>
                        <input
                          type="text"
                          value={tribeName}
                          onChange={(e) => setTribeName(e.target.value)}
                          placeholder="اسم القبيلة (إن عُرفت)"
                          className="w-full px-3 py-2 rounded-xl bg-[#F5F1E8] border border-[#D97757]/45 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#1F1F1C]/85 mb-1">
                          الفرع / الفخذ
                        </label>
                        <input
                          type="text"
                          value={branchName}
                          onChange={(e) => setBranchName(e.target.value)}
                          placeholder="اسم الفرع أو الفخذ (اختياري)"
                          className="w-full px-3 py-2 rounded-xl bg-[#F5F1E8] border border-[#D97757]/45 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Account Section: Verified Email + Phone + Password */}
            <div className="space-y-3.5 rounded-2xl bg-[#F5F1E8]/85 border border-[#D97757]/40 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center justify-between text-xs font-bold text-[#1F1F1C] mb-1">
                    <span>البريد الإلكتروني المدعو</span>
                    <span className="text-[10px] text-[#1F1F1C] font-bold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      موثّق تلقائياً
                    </span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#D97757] absolute right-3 top-2.5 pointer-events-none" />
                    <input
                      type="email"
                      dir="ltr"
                      readOnly
                      value={email}
                      className="w-full pr-9 pl-3 py-2 rounded-xl bg-[#E8DED2]/70 border border-[#D97757]/45 text-xs font-mono text-[#1F1F1C]/85 text-right cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1F1F1C] mb-1">
                    رقم الجوال
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-[#D97757] absolute right-3 top-2.5 pointer-events-none" />
                    <input
                      type="tel"
                      dir="ltr"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+966 5X XXX XXXX"
                      className="w-full pr-9 pl-3 py-2 rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 text-xs font-mono text-right focus:outline-none focus:border-[#D97757]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F1F1C] mb-1">
                  {authMode === 'claim_new'
                    ? 'كلمة المرور لحسابك في جذوري (6 أحرف فأكثر) *'
                    : 'كلمة مرور حسابك الحالي في جذوري *'}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#D97757] absolute right-3 top-2.5 pointer-events-none" />
                  <input
                    type="password"
                    dir="ltr"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 text-xs text-right focus:outline-none focus:border-[#D97757]"
                  />
                </div>
              </div>
            </div>

            {/* Primary Submit + Google Quick Claim */}
            <div className="space-y-2.5 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-sm font-display font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55 shadow-sm transition-colors"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserCheck className="w-4 h-4" />
                )}
                <span>
                  {authMode === 'claim_new'
                    ? `تفعيل عضويتي ودخول بوابة عائلة ${invitation.familyName} ←`
                    : `تسجيل الدخول وتفعيل صلاحية عائلة ${invitation.familyName} ←`}
                </span>
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogleClaim}
                className="w-full py-2.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2]/60 border border-[#D97757]/55 text-[#1F1F1C] text-xs font-display font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
              >
                <ShieldCheck className="w-4 h-4 text-[#D97757]" />
                <span>المتابعة السريعة عبر حساب Google وتفعيل العضوية</span>
              </button>
            </div>
          </form>

          {/* Privacy Footer & Pure Arabic Decline Action */}
          <div className="pt-3 border-t border-[#D97757]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#1F1F1C]/75">
            <span>
              تمنحك هذه العضوية تصفح ديوان العائلة ومشجرتها المشتركة مجاناً مع عزل وحماية كاملة لحسابك.
            </span>
            <button
              type="button"
              disabled={optingOut}
              onClick={handleInstantOptOut}
              className="text-[#D97757] hover:underline font-bold shrink-0 cursor-pointer"
            >
              {optingOut
                ? 'جاري إلغاء الإدراج...'
                : 'الاعتذار عن الانضمام وإزالة بريدي من الدعوة'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
