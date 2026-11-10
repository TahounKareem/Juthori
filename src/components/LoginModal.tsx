import React, { useState } from 'react';
import { X, ArrowLeft, Lock, Mail, Loader2, CheckCircle2 } from 'lucide-react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import {
  createUserProfileIfMissing,
  fetchUserProfile,
  fetchUserProfileByEmail,
} from '../services/firestoreService';
import { AccountLegalType } from '../types/juthori';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (payload: {
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
  }) => void;
}

function inferArabicNameFromEmailOrDisplay(
  email: string,
  displayName?: string | null
): {
  fullName: string;
  firstName: string;
  fatherName: string;
  grandfatherName: string;
  familyName: string;
} {
  const cleanDisplay = (displayName || '').trim();
  if (cleanDisplay && cleanDisplay.includes(' ')) {
    const parts = cleanDisplay.split(/\s+/).filter(Boolean);
    return {
      fullName: cleanDisplay,
      firstName: parts[0] || 'مستخدم',
      fatherName: parts.length > 2 ? parts[1] : '',
      grandfatherName: parts.length > 3 ? parts[2] : '',
      familyName:
        parts.length > 3
          ? parts.slice(3).join(' ')
          : parts.length > 1
          ? parts.slice(1).join(' ')
          : parts[0] || '',
    };
  }

  const localPart = (email.split('@')[0] || '').toLowerCase();
  if (localPart === 'snosi') {
    return {
      fullName: 'كريم شريف خيري السنوسي',
      firstName: 'كريم',
      fatherName: 'شريف',
      grandfatherName: 'خيري',
      familyName: 'السنوسي',
    };
  }
  if (localPart.includes('tahoun') && localPart.includes('kareem')) {
    return {
      fullName: 'كريم شريف طاحون',
      firstName: 'كريم',
      fatherName: 'شريف',
      grandfatherName: '',
      familyName: 'طاحون',
    };
  }

  const hasArabicDisplay = /[\u0600-\u06FF]/.test(cleanDisplay);
  const fallbackName = hasArabicDisplay ? cleanDisplay : 'مستخدم';
  return {
    fullName: fallbackName,
    firstName: fallbackName,
    fatherName: '',
    grandfatherName: '',
    familyName: hasArabicDisplay ? cleanDisplay : '',
  };
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [error, setError] = useState('');
  const [resetNotice, setResetNotice] = useState('');

  if (!isOpen) return null;

  // Google Sign-In with Popup
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError('');
    setResetNotice('');
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const user = res.user;
      const cleanEmail = (user.email || '').trim();

      const existingByEmail = cleanEmail
        ? await fetchUserProfileByEmail(cleanEmail)
        : null;
      const existingByUid = await fetchUserProfile(user.uid);
      const mergedExisting = existingByEmail || existingByUid;

      const rawDisplayName = (user.displayName || '').trim();
      const inferred = inferArabicNameFromEmailOrDisplay(cleanEmail, rawDisplayName);

      const userDoc = await createUserProfileIfMissing(
        {
          uid: user.uid,
          email: user.email,
          displayName: mergedExisting?.fullName || rawDisplayName || inferred.fullName,
        },
        {
          accountType: mergedExisting?.accountType || 'individual',
          fullName:
            mergedExisting?.fullName ||
            rawDisplayName ||
            inferred.fullName ||
            'مستخدم جذوري',
          firstName: mergedExisting?.firstName || inferred.firstName,
          fatherName: mergedExisting?.fatherName || inferred.fatherName,
          grandfatherName: mergedExisting?.grandfatherName || inferred.grandfatherName,
          familyName: mergedExisting?.familyName || inferred.familyName,
          originCountry: mergedExisting?.originCountry || 'السعودية',
          originRegion: mergedExisting?.originRegion,
          tribeName: mergedExisting?.tribeName,
          familyBranch: mergedExisting?.familyBranch,
        }
      );

      const resolvedDoc = mergedExisting?.familyName ? mergedExisting : userDoc;
      const nameParts = (
        resolvedDoc.fullName ||
        rawDisplayName ||
        inferred.fullName ||
        'مستخدم'
      )
        .split(' ')
        .filter(Boolean);

      const resolvedFirstName =
        resolvedDoc.firstName || nameParts[0] || inferred.firstName || 'مستخدم';
      const resolvedFatherName =
        resolvedDoc.fatherName || (nameParts.length > 2 ? nameParts[1] : '') || inferred.fatherName;
      const resolvedGrandfatherName =
        resolvedDoc.grandfatherName ||
        (nameParts.length > 3 ? nameParts[2] : '') ||
        inferred.grandfatherName;
      const resolvedFamilyName =
        resolvedDoc.familyName ||
        (nameParts.length > 3
          ? nameParts.slice(3).join(' ')
          : nameParts.length > 1
          ? nameParts.slice(1).join(' ')
          : inferred.familyName || nameParts[0] || '');

      onLoginSuccess({
        uid: user.uid,
        email: cleanEmail || 'user@juthori.com',
        firstName: resolvedFirstName,
        fatherName: resolvedFatherName,
        grandfatherName: resolvedGrandfatherName,
        familyName: resolvedFamilyName,
        originCountry: resolvedDoc.originCountry || 'السعودية',
        originRegion: resolvedDoc.originRegion || '',
        tribeName: resolvedDoc.tribeName || '',
        branchName: resolvedDoc.familyBranch || '',
        accountType:
          resolvedDoc.accountType === 'record_keeper'
            ? AccountLegalType.RecordKeeper
            : AccountLegalType.Individual,
        subscriptionTier: resolvedDoc.subscriptionTier,
        isRootUnlocked: resolvedDoc.isRootUnlocked,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-closed-by-user')) {
        setError('تم إغلاق نافذة تسجيل الدخول من قبل المستخدم.');
        return;
      }
      setError('تعذر تسجيل الدخول عبر Google في هذه النافذة. يرجى الدخول بالبريد الإلكتروني.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('يرجى كتابة بريدك الإلكتروني في الحقل أعلاه أولاً لإرسال رابط استعادة كلمة المرور.');
      return;
    }
    setIsSendingReset(true);
    setError('');
    setResetNotice('');
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setResetNotice(
        `تم إرسال رابط إعادة تعيين كلمة المرور بنجاح إلى (${cleanEmail}). يرجى فتح بريدك الإلكتروني وتعيين كلمة المرور الجديدة ثم تسجيل الدخول هنا مباشرًة.`
      );
    } catch {
      setError('تعذر إرسال بريد استعادة كلمة المرور. يرجى التأكد من صحة البريد الإلكتروني المدخل.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('يرجى إدخال بريد إلكتروني صحيح');
      return;
    }
    if (!password || password.length < 6) {
      setError('يرجى إدخال كلمة المرور (6 خانات على الأقل)');
      return;
    }

    setIsLoading(true);
    setError('');
    setResetNotice('');

    let uid = '';
    let authDisplayName = '';
    let authenticatedViaFirebaseAuth = false;
    const typedFullName = fullName.trim();

    // Look up existing profile in Firestore by email (checks `users`, `customer_orders`, and `research_tickets`)
    const profileByEmail = await fetchUserProfileByEmail(cleanEmail);

    if (isRegisterMode) {
      try {
        const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        uid = userCred.user.uid;
        authDisplayName = userCred.user.displayName || '';
        authenticatedViaFirebaseAuth = true;
        sendEmailVerification(userCred.user).catch(() => {});
      } catch (regErr: unknown) {
        const regMsg = regErr instanceof Error ? regErr.message : String(regErr);
        if (regMsg.includes('email-already-in-use')) {
          try {
            const signCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
            uid = signCred.user.uid;
            authDisplayName = signCred.user.displayName || '';
            authenticatedViaFirebaseAuth = true;
          } catch {
            setError(
              'هذا البريد الإلكتروني مسجل بالفعل. يرجى التبديل إلى «تسجيل الدخول» أو الضغط على «نسيت كلمة المرور؟» لاستعادتها.'
            );
            setIsLoading(false);
            return;
          }
        } else {
          uid = profileByEmail?.userId || `usr_${Date.now()}`;
        }
      }
    } else {
      // Login Mode: Authenticate with Firebase Auth FIRST (supports users who changed their password via Firebase email link!)
      try {
        const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        uid = userCred.user.uid;
        authDisplayName = userCred.user.displayName || '';
        authenticatedViaFirebaseAuth = true;
      } catch (signErr: unknown) {
        const signMsg = signErr instanceof Error ? signErr.message : String(signErr);
        // If the customer has a profile in Firestore (e.g. from OTP registration) and isn't in Firebase Auth yet, provision them
        if (profileByEmail) {
          try {
            const created = await createUserWithEmailAndPassword(auth, cleanEmail, password);
            uid = created.user.uid;
            authDisplayName = created.user.displayName || '';
            authenticatedViaFirebaseAuth = true;
          } catch (createErr: unknown) {
            const createMsg = createErr instanceof Error ? createErr.message : String(createErr);
            if (createMsg.includes('email-already-in-use') || signMsg.includes('wrong-password') || signMsg.includes('invalid-credential')) {
              setError(
                'كلمة المرور غير صحيحة. إذا قمت بتغييرها مؤخراً أو نسيتها، اضغط على «نسيت كلمة المرور؟» أدناه لإرسال رابط الاستعادة لبريدك.'
              );
              setIsLoading(false);
              return;
            }
            uid = profileByEmail.userId || `usr_${Date.now()}`;
          }
        } else {
          // Neither Firebase Auth sign-in succeeded nor Firestore profile found
          if (signMsg.includes('wrong-password') || signMsg.includes('invalid-credential')) {
            setError(
              'كلمة المرور غير صحيحة أو الحساب غير مسجل بعد. يمكنك الضغط على «نسيت كلمة المرور؟» لاستعادتها عبر البريد، أو إنشاء حساب جديد.'
            );
          } else {
            setError(
              'لا يوجد حساب عميل مسجل بهذا البريد الإلكتروني. يمكنك الضغط على «إنشاء حساب جديد» أدناه للتسجيل فوراً.'
            );
          }
          setIsLoading(false);
          return;
        }
      }
    }

    const safeUid = uid || profileByEmail?.userId || `usr_${Date.now()}`;
    const profileByUid = await fetchUserProfile(safeUid);

    // Prefer the profile that actually has the user's registered familyName
    const storedProfile =
      (profileByEmail?.familyName ? profileByEmail : null) ||
      (profileByUid?.familyName ? profileByUid : null) ||
      profileByEmail ||
      profileByUid;

    if (!isRegisterMode && !storedProfile && !authenticatedViaFirebaseAuth) {
      setError('لا يوجد حساب عميل مسجل بهذا البريد الإلكتروني في قاعدة البيانات.');
      setIsLoading(false);
      return;
    }

    const inferredFromIdentity = inferArabicNameFromEmailOrDisplay(
      cleanEmail,
      typedFullName || storedProfile?.fullName || authDisplayName
    );

    const effectiveFullName =
      typedFullName ||
      storedProfile?.fullName ||
      authDisplayName ||
      inferredFromIdentity.fullName;

    const nameParts = effectiveFullName.split(' ').filter(Boolean);

    const resolvedFirstName =
      (isRegisterMode && typedFullName ? nameParts[0] : storedProfile?.firstName) ||
      nameParts[0] ||
      inferredFromIdentity.firstName;

    const resolvedFatherName =
      (isRegisterMode && typedFullName && nameParts.length > 2
        ? nameParts[1]
        : storedProfile?.fatherName) ||
      (nameParts.length > 2 ? nameParts[1] : '') ||
      inferredFromIdentity.fatherName ||
      '';

    const resolvedGrandfatherName =
      (isRegisterMode && typedFullName && nameParts.length > 3
        ? nameParts[2]
        : storedProfile?.grandfatherName) ||
      (nameParts.length > 3 ? nameParts[2] : '') ||
      inferredFromIdentity.grandfatherName ||
      '';

    const resolvedFamilyName =
      (isRegisterMode && typedFullName && nameParts.length > 1
        ? nameParts.length > 3
          ? nameParts.slice(3).join(' ')
          : nameParts.slice(1).join(' ')
        : storedProfile?.familyName) ||
      (nameParts.length > 3
        ? nameParts.slice(3).join(' ')
        : nameParts.length > 1
        ? nameParts.slice(1).join(' ')
        : inferredFromIdentity.familyName || resolvedFirstName);

    const resolvedCountry = storedProfile?.originCountry || 'مصر';
    const resolvedRegion = storedProfile?.originRegion || '';
    const resolvedTribe = storedProfile?.tribeName || '';
    const resolvedBranch = storedProfile?.familyBranch || '';
    const resolvedAccountType =
      storedProfile?.accountType === 'record_keeper'
        ? AccountLegalType.RecordKeeper
        : AccountLegalType.Individual;

    // Ensure profile is saved/healed under the active UID in Firestore
    await createUserProfileIfMissing(
      {
        uid: safeUid,
        email: cleanEmail,
        displayName:
          storedProfile?.fullName ||
          [resolvedFirstName, resolvedFatherName, resolvedGrandfatherName, resolvedFamilyName]
            .filter(Boolean)
            .join(' '),
      },
      {
        fullName:
          storedProfile?.fullName ||
          [resolvedFirstName, resolvedFatherName, resolvedGrandfatherName, resolvedFamilyName]
            .filter(Boolean)
            .join(' '),
        firstName: resolvedFirstName,
        fatherName: resolvedFatherName,
        grandfatherName: resolvedGrandfatherName,
        familyName: resolvedFamilyName,
        email: cleanEmail,
        originCountry: resolvedCountry,
        originRegion: resolvedRegion,
        tribeName: resolvedTribe,
        familyBranch: resolvedBranch,
        accountType:
          resolvedAccountType === AccountLegalType.RecordKeeper
            ? 'record_keeper'
            : 'individual',
        subscriptionTier: storedProfile?.subscriptionTier || 'free',
        walletBalance: storedProfile?.walletBalance ?? 0,
        isRootUnlocked: storedProfile?.isRootUnlocked ?? false,
      }
    );

    onLoginSuccess({
      uid: safeUid,
      email: cleanEmail,
      firstName: resolvedFirstName,
      fatherName: resolvedFatherName,
      grandfatherName: resolvedGrandfatherName,
      familyName: resolvedFamilyName,
      originCountry: resolvedCountry,
      originRegion: resolvedRegion,
      tribeName: resolvedTribe,
      branchName: resolvedBranch,
      accountType: resolvedAccountType,
      subscriptionTier: storedProfile?.subscriptionTier,
      isRootUnlocked: storedProfile?.isRootUnlocked,
    });
    setIsLoading(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#252321]/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/40 p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2
              id="login-modal-title"
              className="text-xl font-display font-bold text-[#252321]"
            >
              {isRegisterMode ? 'إنشاء حساب جديد في جذوري' : 'تسجيل الدخول إلى جذوري'}
            </h2>
            <p className="text-xs text-[#252321]/70 mt-1">
              {isRegisterMode
                ? 'أنشئ حسابك لحفظ شجرة عائلتك وتتبع تذاكر البحث الأرشيفي'
                : 'ادخل إلى لوحة تحكم عمود نسبك وسجل عائلتك الموثق'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة تسجيل الدخول"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[#252321]/70 hover:bg-[#EDE6DA] hover:text-[#252321] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Google One-Click Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full py-2.5 px-4 mb-4 rounded-xl bg-white border border-[#B98A78]/40 hover:bg-[#FAF6EE] text-[#252321] font-semibold text-xs flex items-center justify-center gap-3 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span>المتابعة باستخدام حساب Google</span>
        </button>

        <div className="flex items-center gap-3 my-3">
          <div className="flex-1 h-px bg-[#B98A78]/30"></div>
          <span className="text-[11px] text-[#252321]/50 font-medium">أو بالبريد الإلكتروني</span>
          <div className="flex-1 h-px bg-[#B98A78]/30"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          {isRegisterMode && (
            <div>
              <label htmlFor="reg-name" className="block text-xs font-medium text-[#252321] mb-1">
                الاسم الكامل رباعي
              </label>
              <input
                id="reg-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3.5 py-2 text-right text-xs text-[#252321] focus:outline-none focus:border-[#D8755B]"
                placeholder="الاسم الأول، الأب، الجد، اسم العائلة"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-medium text-[#252321] mb-1"
            >
              البريد الإلكتروني
            </label>
            <div className="relative">
              <input
                id="login-email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3.5 py-2 pl-9 text-right text-xs text-[#252321] focus:outline-none focus:border-[#D8755B]"
                placeholder="name@example.com"
              />
              <Mail
                className="w-3.5 h-3.5 text-[#B98A78] absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-[#252321]"
              >
                كلمة المرور
              </label>
              {!isRegisterMode && (
                <button
                  type="button"
                  disabled={isSendingReset}
                  onClick={handleForgotPassword}
                  className="text-[11px] font-semibold text-[#D8755B] hover:underline cursor-pointer disabled:opacity-50"
                >
                  {isSendingReset ? 'جاري إرسال الرابط...' : 'نسيت كلمة المرور؟'}
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="login-password"
                type="password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3.5 py-2 pl-9 text-right text-xs text-[#252321] focus:outline-none focus:border-[#D8755B]"
                placeholder="••••••••"
              />
              <Lock
                className="w-3.5 h-3.5 text-[#B98A78] absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
            </div>
          </div>

          {resetNotice && (
            <p
              role="status"
              className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{resetNotice}</span>
            </p>
          )}

          {error && (
            <p role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white font-display font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{isRegisterMode ? 'إتمام إنشاء الحساب' : 'الدخول إلى لوحة التحكم'}</span>
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-[#B98A78]/20 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setError('');
              setResetNotice('');
            }}
            className="text-xs text-[#D8755B] hover:underline font-semibold cursor-pointer"
          >
            {isRegisterMode
              ? 'لديك حساب بالفعل؟ تسجيل الدخول'
              : 'ليس لديك حساب؟ إنشاء حساب جديد برقم هاتف أو بريد'}
          </button>
        </div>
      </div>
    </div>
  );
};

