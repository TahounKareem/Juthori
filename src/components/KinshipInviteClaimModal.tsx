import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
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
  residenceCountry: string;
  residenceCity: string;
  profession: string;
  invitation: KinshipInvitationDoc;
}

interface KinshipInviteClaimModalProps {
  isOpen: boolean;
  invitation: KinshipInvitationDoc;
  onClose: () => void;
  onClaimCompleted: (payload: ClaimedKinshipSessionPayload) => void;
  onOptOutCompleted?: (messageAr: string) => void;
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
  const [authMode, setAuthMode] = useState<'claim_new' | 'sign_in_existing'>(
    'claim_new'
  );
  const [relativeName, setRelativeName] = useState(
    invitation.relativeName || ''
  );
  const [email] = useState((invitation.invitedEmail || '').trim().toLowerCase());
  const [password, setPassword] = useState('');

  // 3 Optional Enrichment Fields
  const [showEnrichmentFields, setShowEnrichmentFields] = useState(true);
  const [fatherName, setFatherName] = useState(invitation.fatherName || '');
  const [grandfatherName, setGrandfatherName] = useState(
    invitation.grandfatherName || ''
  );
  const [residenceCountry, setResidenceCountry] = useState(
    invitation.residenceCountry || invitation.originCountry || 'السعودية'
  );
  const [residenceCity, setResidenceCity] = useState(
    invitation.residenceCity || ''
  );
  const [profession, setProfession] = useState(invitation.profession || '');

  const [submitting, setSubmitting] = useState(false);
  const [optingOut, setOptingOut] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setRelativeName(invitation.relativeName || '');
    setFatherName(invitation.fatherName || '');
    setGrandfatherName(invitation.grandfatherName || '');
    setResidenceCountry(
      invitation.residenceCountry || invitation.originCountry || 'السعودية'
    );
    setResidenceCity(invitation.residenceCity || '');
    setProfession(invitation.profession || '');
  }, [invitation]);

  if (!isOpen) return null;

  const finalizeClaimForAuthenticatedUser = async (firebaseUser: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
  }) => {
    const cleanFirst =
      relativeName.trim().split(/\s+/)[0] ||
      invitation.relativeName.trim().split(/\s+/)[0] ||
      'عضو';
    const cleanFather = fatherName.trim();
    const cleanGrand = grandfatherName.trim();
    const cleanFamily = (invitation.familyName || 'العائلة').trim();
    const composedFullName = [
      relativeName.trim() || cleanFirst,
      cleanFather,
      cleanGrand,
      relativeName.includes(cleanFamily) ? '' : cleanFamily,
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 140);

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
        originCountry: invitation.originCountry || 'السعودية',
        originRegion: invitation.originRegion || '',
        defaultCountry:
          residenceCountry.trim() || invitation.originCountry || 'السعودية',
        residenceCity: residenceCity.trim() || undefined,
        profession: profession.trim() || undefined,
        accountType: 'individual',
        subscriptionTier: 'free',
        agreedToTermsAndPrivacy: true,
        termsAndPrivacyAgreedAt: nowIso,
        emailVerified: isAutoVerifiedByInviteToken ? true : undefined,
        emailVerifiedAt: isAutoVerifiedByInviteToken ? nowIso : undefined,
        referredByUserId: invitation.ownerId,
        referredByCode: invitation.referralCode,
      },
      { skipTeamCheck: false }
    );

    // Guarantee enrichment fields & auto-verified invite email are saved even if an existing/skeleton profile already existed
    const existingHadPlaceholderName =
      !ensuredProfile.familyName ||
      ensuredProfile.firstName === 'مستخدم' ||
      ensuredProfile.familyName === cleanFamily;
    await updateUserProfile(firebaseUser.uid, {
      ...(existingHadPlaceholderName
        ? {
            fullName: composedFullName,
            firstName: cleanFirst,
            familyName: cleanFamily,
            originCountry:
              ensuredProfile.originCountry ||
              invitation.originCountry ||
              'السعودية',
            originRegion:
              ensuredProfile.originRegion || invitation.originRegion || '',
          }
        : {}),
      fatherName: cleanFather || ensuredProfile.fatherName || undefined,
      grandfatherName:
        cleanGrand || ensuredProfile.grandfatherName || undefined,
      defaultCountry:
        residenceCountry.trim() ||
        ensuredProfile.defaultCountry ||
        invitation.originCountry ||
        'السعودية',
      residenceCity:
        residenceCity.trim() || ensuredProfile.residenceCity || undefined,
      profession: profession.trim() || ensuredProfile.profession || undefined,
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
        fatherName: cleanFather || undefined,
        grandfatherName: cleanGrand || undefined,
        residenceCountry: residenceCountry.trim() || undefined,
        residenceCity: residenceCity.trim() || undefined,
        profession: profession.trim() || undefined,
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
      originCountry: invitation.originCountry || 'السعودية',
      originRegion: invitation.originRegion || '',
      fatherName: cleanFather,
      grandfatherName: cleanGrand,
      residenceCountry:
        residenceCountry.trim() || invitation.originCountry || 'السعودية',
      residenceCity: residenceCity.trim(),
      profession: profession.trim(),
      invitation: updatedInvite,
    });
  };

  const handlePasswordClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

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
        if (relativeName.trim()) {
          await updateProfile(cred.user, {
            displayName: relativeName.trim(),
          }).catch(() => {});
        }
        syncMirrorSession(email, password);
        await finalizeClaimForAuthenticatedUser(cred.user);
      } catch (createErr: unknown) {
        const code = (createErr as { code?: string })?.code || '';
        if (code === 'auth/email-already-in-use') {
          // Seamless zero-friction fallback: try signing in with the entered password!
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
      className="fixed inset-0 z-50 bg-[#252321]/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-[#F7F2E9] text-[#252321] border border-[#B98A78]/65 shadow-2xl overflow-hidden my-6">
        {/* Royal Heritage Header */}
        <div className="bg-[#252321] text-[#F7F2E9] px-6 py-5 border-b-2 border-[#D8755B] relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 p-1.5 rounded-lg text-[#F7F2E9]/70 hover:text-white hover:bg-white/10 cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-xs font-bold text-[#E8C284] mb-2">
            <Sparkles className="w-4 h-4 text-[#D8755B]" />
            <span>دعوة صلة رحم موثقة · الدائرة العائلية الخاصة</span>
          </div>

          <h2 className="text-lg sm:text-xl font-display font-bold leading-relaxed pl-8">
            مرحباً بك يا {invitation.relativeName} ({invitation.kinshipRelation}) في ديوان وبوابة عائلة {invitation.familyName} — بدعوة كريمة من أمين السجل {invitation.inviterName} ✦
          </h2>

          <p className="text-xs text-[#F7F2E9]/80 mt-2 leading-relaxed">
            أكمل خطوة التفعيل السريعة أدناه لفتح كامل الأقسام العائلية الخاصة، تصفح مشجرة الفروع المعاصرة، والمساهمة في إثراء سجل الأسرة بصفتك عضو عائلة معتمد وموثّق البريد تلقائياً.
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="rounded-xl bg-red-950/10 border border-red-800/35 px-4 py-3 text-xs font-semibold text-red-900">
              {errorMsg}
            </div>
          )}

          {/* Mode Switcher Pill-free Segmented Control */}
          <div className="flex items-center justify-between gap-2 bg-[#EDE6DA] p-1 rounded-xl border border-[#B98A78]/35">
            <button
              type="button"
              onClick={() => {
                setAuthMode('claim_new');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-display font-bold transition-colors cursor-pointer ${
                authMode === 'claim_new'
                  ? 'bg-[#252321] text-[#F7F2E9]'
                  : 'text-[#252321]/75 hover:text-[#252321]'
              }`}
            >
              تفعيل عضويتي لأول مرة (خطوة واحدة)
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('sign_in_existing');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-display font-bold transition-colors cursor-pointer ${
                authMode === 'sign_in_existing'
                  ? 'bg-[#252321] text-[#F7F2E9]'
                  : 'text-[#252321]/75 hover:text-[#252321]'
              }`}
            >
              لدي حساب سابق في جذوري
            </button>
          </div>

          <form onSubmit={handlePasswordClaimSubmit} className="space-y-4">
            {/* Pre-filled Core Identity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-[#252321] mb-1">
                  الاسم الكريم في سجل العائلة *
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 text-[#8D4925] absolute right-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={relativeName}
                    onChange={(e) => setRelativeName(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 rounded-xl bg-white border border-[#B98A78]/55 text-xs font-semibold text-[#252321]"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-bold text-[#252321] mb-1">
                  <span>البريد الإلكتروني المدعوّ</span>
                  <span className="text-[10px] text-emerald-800 font-bold inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    موثّق تلقائياً بالدعوة
                  </span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8D4925] absolute right-3 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    dir="ltr"
                    readOnly
                    value={email}
                    className="w-full pr-9 pl-3 py-2 rounded-xl bg-[#EDE6DA]/70 border border-[#B98A78]/45 text-xs font-mono text-[#252321]/85 text-right cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-bold text-[#252321] mb-1">
                {authMode === 'claim_new'
                  ? 'اختر كلمة مرور لحفظ صلاحيتك العائلية (6 أحرف فأكثر) *'
                  : 'أدخل كلمة مرور حسابك الحالي في جذوري *'}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#8D4925] absolute right-3 top-2.5 pointer-events-none" />
                <input
                  type="password"
                  dir="ltr"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-white border border-[#B98A78]/55 text-xs text-right"
                />
              </div>
            </div>

            {/* 3 Optional Enrichment Fields */}
            <div className="rounded-xl bg-white/80 border border-[#B98A78]/40 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowEnrichmentFields((v) => !v)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-right text-xs font-display font-bold text-[#8D4925] hover:bg-[#EDE6DA]/50 cursor-pointer"
              >
                <span>
                  ✦ بيانات إثرائية اختيارية لتوثيق فرعك في ديوان وأطلس الأسرة (اختياري)
                </span>
                {showEnrichmentFields ? (
                  <ChevronUp className="w-4 h-4 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 shrink-0" />
                )}
              </button>

              {showEnrichmentFields && (
                <div className="px-4 pb-4 pt-2 border-t border-[#B98A78]/25 space-y-3">
                  {/* 1. Father & Grandfather Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#252321]/80 mb-1">
                        اسم الأب (اختياري)
                      </label>
                      <input
                        type="text"
                        value={fatherName}
                        onChange={(e) => setFatherName(e.target.value)}
                        placeholder="مثال: محمد"
                        className="w-full px-3 py-2 rounded-lg bg-[#F7F2E9]/70 border border-[#B98A78]/45 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#252321]/80 mb-1">
                        اسم الجد (اختياري)
                      </label>
                      <input
                        type="text"
                        value={grandfatherName}
                        onChange={(e) => setGrandfatherName(e.target.value)}
                        placeholder="مثال: عبدالله"
                        className="w-full px-3 py-2 rounded-lg bg-[#F7F2E9]/70 border border-[#B98A78]/45 text-xs"
                      />
                    </div>
                  </div>

                  {/* 2. Current Residence Country & City */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#252321]/80 mb-1">
                        دولة الإقامة الحالية (اختياري)
                      </label>
                      <div className="relative">
                        <MapPin className="w-3.5 h-3.5 text-[#8D4925] absolute right-2.5 top-2.5 pointer-events-none" />
                        <input
                          type="text"
                          value={residenceCountry}
                          onChange={(e) => setResidenceCountry(e.target.value)}
                          placeholder="مثال: السعودية"
                          className="w-full pr-8 pl-3 py-2 rounded-lg bg-[#F7F2E9]/70 border border-[#B98A78]/45 text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#252321]/80 mb-1">
                        مدينة الإقامة الحالية (اختياري)
                      </label>
                      <input
                        type="text"
                        value={residenceCity}
                        onChange={(e) => setResidenceCity(e.target.value)}
                        placeholder="مثال: الرياض / جدة / بغداد..."
                        className="w-full px-3 py-2 rounded-lg bg-[#F7F2E9]/70 border border-[#B98A78]/45 text-xs"
                      />
                    </div>
                  </div>

                  {/* 3. Profession / Specialty */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#252321]/80 mb-1">
                      المهنة / التخصص (لإثراء شبكة أبناء العمومة — اختياري)
                    </label>
                    <div className="relative">
                      <Briefcase className="w-3.5 h-3.5 text-[#8D4925] absolute right-2.5 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        value={profession}
                        onChange={(e) => setProfession(e.target.value)}
                        placeholder="مثال: طب، هندسة، أعمال، أكاديمي..."
                        className="w-full pr-8 pl-3 py-2 rounded-lg bg-[#F7F2E9]/70 border border-[#B98A78]/45 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Primary Submit + Google Quick Claim */}
            <div className="space-y-2.5 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-sm font-display font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55 shadow-sm"
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
                className="w-full py-2.5 rounded-xl bg-white hover:bg-[#EDE6DA]/60 border border-[#B98A78]/55 text-[#252321] text-xs font-display font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
              >
                <ShieldCheck className="w-4 h-4 text-[#8D4925]" />
                <span>المتابعة السريعة عبر حساب Google وتفعيل العضوية</span>
              </button>
            </div>
          </form>

          {/* Privacy Footer & Instant 1-Click Opt-Out */}
          <div className="pt-3 border-t border-[#B98A78]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#252321]/70">
            <span>
              تمنحك هذه العضوية تصفح البوابة المعاصرة مجاناً مع حماية كاملة لخصوصية بياناتك.
            </span>
            <button
              type="button"
              disabled={optingOut}
              onClick={handleInstantOptOut}
              className="text-[#8D4925] hover:underline font-bold shrink-0 cursor-pointer"
            >
              {optingOut
                ? 'جاري إلغاء الإدراج...'
                : 'لا أرغب بالانضمام — احذف بريدي فوراً (Opt-out)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
