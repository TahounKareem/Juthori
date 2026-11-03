import React, { useState, useEffect } from 'react';
import {
  Compass,
  Database,
  ShieldCheck,
  Sparkles,
  Lock,
  Mail,
  ArrowLeft,
  Search,
  Loader2,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';
import {
  AccountLegalType,
  LineageSearchResult,
  RegistrationFormState,
} from '../types/juthori';
import { JuthoriLogo } from './JuthoriLogo';
import { validateStep2PreservationForm } from '../utils/lineageEngine';

interface SearchProgressScreenProps {
  form: RegistrationFormState;
  result: LineageSearchResult;
  onCompletePreservation: (credentials: {
    email: string;
    password: string;
    accountType: AccountLegalType;
    selectedDisambiguation?: 'option_a' | 'option_b' | 'not_sure_ticket';
  }) => Promise<void>;
  onGoogleSignInPreserve: () => Promise<void>;
  onBackToEdit: () => void;
}

export const SearchProgressScreen: React.FC<SearchProgressScreenProps> = ({
  form,
  result,
  onCompletePreservation,
  onGoogleSignInPreserve,
  onBackToEdit,
}) => {
  // Labor Illusion Stages (4 stages over 3.6 seconds)
  const [progressPercent, setProgressPercent] = useState(0);
  const [activeStage, setActiveStage] = useState<1 | 2 | 3 | 4>(1);
  const [nodeCount, setNodeCount] = useState(0);
  const [isInspectionComplete, setIsInspectionComplete] = useState(false);

  // Rule 1.1: Never show verification/disambiguation questions before the $5 payment!
  // Verification happens in the dashboard immediately AFTER unlocking the Root ($5).
  const [disambiguationResolved, setDisambiguationResolved] = useState<boolean>(true);
  const [selectedDisambiguationOption, setSelectedDisambiguationOption] = useState<
    'option_a' | 'option_b' | 'not_sure_ticket' | undefined
  >(undefined);

  // Form State for Gateway ("تأكيد وحفظ الاكتشاف")
  const [authMode, setAuthMode] = useState<'password' | 'otp'>('password');
  const [email, setEmail] = useState(form.email || '');
  const [password, setPassword] = useState(form.password || '');
  const [otpCode, setOtpCode] = useState('');
  const [otpSentNotice, setOtpSentNotice] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 0. Mandatory Global Scroll-to-Top on mount and stage completion
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [isInspectionComplete, disambiguationResolved]);

  // 1. Progress Simulation (Labor illusion in Adam's Tree)
  useEffect(() => {
    const totalDuration = 3600;
    const intervalTime = 40;
    const increment = 100 / (totalDuration / intervalTime);

    const timer = setInterval(() => {
      setProgressPercent((prev) => {
        const next = Math.min(prev + increment, 100);

        if (next < 25) {
          setActiveStage(1);
          setNodeCount(Math.floor(next * 8000));
        } else if (next < 60) {
          setActiveStage(2);
          setNodeCount(Math.floor(200000 + (next - 25) * 58000));
        } else if (next < 98) {
          setActiveStage(3);
          setNodeCount(Math.min(2271840, Math.floor(2230000 + (next - 60) * 1100)));
        } else {
          setActiveStage(4);
          setNodeCount(2271840);
          setIsInspectionComplete(true);
          clearInterval(timer);
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, []);

  const handleConfirmDisambiguationSelection = () => {
    setDisambiguationResolved(true);
  };

  const handleNotSureDisambiguation = () => {
    setSelectedDisambiguationOption('not_sure_ticket');
    setDisambiguationResolved(true);
  };

  const handleSendRealOtpEmail = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFormErrors({ email: 'يرجى إدخال البريد الإلكتروني أولاً لإرسال رمز التحقق.' });
      return;
    }
    setFormErrors({});
    setIsSendingOtp(true);
    setOtpSentNotice(null);
    try {
      const resp = await fetch('/api/juthori/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          clientName: `${form.firstName} ${form.familyName}`.trim(),
          familyName: form.familyName,
        }),
      });
      const data = await resp.json().catch(() => null);
      if (resp.ok && data?.ok) {
        if (data.dispatched) {
          setOtpSentNotice(
            `تم إرسال رمز التحقق (OTP) عبر Resend إلى بريدك (${cleanEmail}) ✓`
          );
        } else if (data.fallbackOtpCode) {
          setOtpCode(String(data.fallbackOtpCode));
          setOtpSentNotice(
            `رمز التحقق الفوري لتفعيل حسابك هو: [ ${data.fallbackOtpCode} ] — تمت تعبئته تلقائياً (ملاحظة: لإرسال البريد خارجياً عبر Resend يرجى التأكد من إضافة RESEND_API_KEY وتوثيق نطاق Juthori.com في Resend).`
          );
        } else {
          setOtpSentNotice(
            `تم إصدار رمز التحقق للبريد (${cleanEmail}) عبر info@Juthori.com`
          );
        }
      } else {
        setOtpSentNotice(
          data?.error || `تعذر إرسال رمز التحقق للبريد (${cleanEmail}).`
        );
      }
    } catch {
      setOtpSentNotice(
        `تعذر الاتصال بخادم البريد لإرسال رمز التحقق إلى (${cleanEmail}).`
      );
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSubmitPreservation = async (e: React.FormEvent) => {
    e.preventDefault();
    const secretValue = authMode === 'otp' ? otpCode.trim() : password;
    const check = validateStep2PreservationForm(
      email,
      secretValue,
      agreedToTerms
    );

    if (!check.valid) {
      setFormErrors(check.errors as Record<string, string>);
      return;
    }

    setFormErrors({});
    setIsSaving(true);
    try {
      if (authMode === 'otp') {
        const verifyResp = await fetch('/api/juthori/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            code: secretValue,
          }),
        });
        const verifyData = await verifyResp.json().catch(() => null);
        if (!verifyResp.ok || !verifyData?.ok) {
          setFormErrors({
            password:
              verifyData?.message ||
              'رمز التحقق غير صحيح أو منتهي الصلاحية. يرجى طلب رمز جديد.',
          });
          setIsSaving(false);
          return;
        }
      } else {
        // Dispatch real verification/welcome OTP email via Resend API in background
        fetch('/api/juthori/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            clientName: `${form.firstName} ${form.familyName}`.trim(),
          }),
        }).catch(() => {});
      }

      await onCompletePreservation({
        email: email.trim(),
        password: secretValue.length < 6 ? `${secretValue}Jth!` : secretValue,
        accountType: form.accountType,
        selectedDisambiguation: selectedDisambiguationOption,
      });
    } catch (err) {
      console.warn('Preservation save notice:', err);
      setFormErrors({
        form: 'تعذر حفظ السجل. يرجى المحاولة مرة أخرى أو استخدام حساب Google.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isMatched =
    result.matched && selectedDisambiguationOption !== 'not_sure_ticket';

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#F7F2E9] text-[#252321] flex flex-col justify-between"
    >
      {/* 1. Header with Official 3-Step Progress Indicator */}
      <header className="sticky top-0 z-30 bg-[#F7F2E9]/95 backdrop-blur-md border-b border-[#B98A78]/30">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <JuthoriLogo size="md" onClick={onBackToEdit} />

          {/* Stepper Center Indicator: 1. البيانات الأساسية <- 2. التحقق <- 3. النتيجة */}
          <nav
            aria-label="مراحل البحث"
            className="hidden sm:flex items-center gap-3 text-xs md:text-sm font-display font-semibold"
          >
            <button
              type="button"
              onClick={onBackToEdit}
              className="flex items-center gap-2 text-[#252321]/70 hover:text-[#252321] transition-colors cursor-pointer"
            >
              <span className="w-6 h-6 rounded-full bg-[#252321] text-white flex items-center justify-center text-xs">
                1
              </span>
              <span>1. البيانات الأساسية</span>
            </button>

            <span className="text-[#B98A78]" aria-hidden="true">
              ←
            </span>

            <div className="flex items-center gap-2 text-[#D8755B] font-bold">
              <span className="w-6 h-6 rounded-full bg-[#D8755B] text-white flex items-center justify-center text-xs ring-4 ring-[#D8755B]/20">
                2
              </span>
              <span>2. التحقق</span>
            </div>

            <span className="text-[#B98A78]" aria-hidden="true">
              ←
            </span>

            <div className="flex items-center gap-2 text-[#252321]/40">
              <span className="w-6 h-6 rounded-full bg-[#EDE6DA] text-[#252321]/60 flex items-center justify-center text-xs">
                3
              </span>
              <span>3. النتيجة</span>
            </div>
          </nav>

          <button
            type="button"
            onClick={onBackToEdit}
            className="text-xs font-semibold text-[#252321]/70 hover:text-[#D8755B] border border-[#B98A78]/40 px-3 py-1.5 rounded-xl hover:bg-[#EDE6DA] transition-colors cursor-pointer"
          >
            تعديل البيانات
          </button>
        </div>
      </header>

      {/* 2. Main Verification & Preservation Screen */}
      <main className="flex-1 max-w-[760px] mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full flex flex-col justify-center">
        {/* STAGE A: Scanning Progress */}
        {!isInspectionComplete ? (
          <div className="rounded-3xl bg-white border border-[#B98A78]/45 p-6 sm:p-10 shadow-xl space-y-8 text-center relative overflow-hidden">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#D8755B]/15 text-[#D8755B] text-xs font-bold">
                <Compass
                  className="w-3.5 h-3.5 animate-spin"
                  style={{ animationDuration: '6s' }}
                />
                <span>فحص السجلات الموثقة</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-display font-extrabold text-[#252321]">
                جاري التحقق من سجل عائلة ({form.familyName})
              </h1>
            </div>

            <div className="relative w-40 h-40 sm:w-44 sm:h-44 mx-auto flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-full border border-[#B98A78]/30 animate-ping"
                style={{ animationDuration: '3s' }}
              />
              <div className="absolute inset-4 rounded-full border border-[#D8755B]/40" />
              <div className="absolute inset-10 rounded-full border border-[#252321]/15" />

              <div
                className="absolute inset-0 rounded-full border-t-2 border-r-2 border-[#D8755B] animate-spin"
                style={{ animationDuration: '1.8s' }}
              />

              <div className="relative z-10 w-24 h-24 rounded-full bg-[#F7F2E9] border-2 border-[#D8755B] shadow-inner flex flex-col items-center justify-center p-2">
                <span className="text-2xl font-display font-extrabold text-[#252321] tabular-nums">
                  {Math.round(progressPercent)}%
                </span>
              </div>
            </div>

            <div className="max-w-lg mx-auto space-y-4">
              <div className="h-2 w-full bg-[#EDE6DA] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-l from-[#D8755B] to-[#c5644b] transition-all duration-100 ease-out rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/40 p-3.5 transition-all">
                {activeStage === 1 && (
                  <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-[#252321]">
                    <Search className="w-4 h-4 text-[#D8755B] animate-pulse" />
                    <span>تحليل الاسم العائلي والبيانات الجغرافية...</span>
                  </div>
                )}
                {activeStage === 2 && (
                  <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-[#252321]">
                    <Database className="w-4 h-4 text-[#D8755B] animate-pulse" />
                    <span>
                      فحص السجلات الموثقة (
                      <strong className="text-[#D8755B] tabular-nums font-mono">
                        {nodeCount.toLocaleString('ar-SA')}
                      </strong>{' '}
                      سجل)...
                    </span>
                  </div>
                )}
                {activeStage === 3 && (
                  <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-[#252321]">
                    <ShieldCheck className="w-4 h-4 text-[#D8755B] animate-pulse" />
                    <span>التحقق من الامتداد الجغرافي والتاريخي...</span>
                  </div>
                )}
                {activeStage === 4 && (
                  <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-[#8D4925]">
                    <Sparkles className="w-4 h-4 text-[#D8755B]" />
                    <span>اكتمل الفحص بنجاح</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : !disambiguationResolved ? (
          /* STAGE B: STRICTLY PROFESSIONAL & CONCISE DISAMBIGUATION WINDOW */
          <div className="rounded-3xl bg-white border border-[#B98A78]/50 p-6 sm:p-10 shadow-xl space-y-6 text-right">
            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-display font-extrabold text-[#252321]">
                تأكيد النطاق الجغرافي لعائلة ({form.familyName})
              </h1>
              <p className="text-sm text-[#252321]/75">
                يرجى تحديد النطاق المرتبط بامتداد أسرتكم لاستكمال المطابقة:
              </p>
            </div>

            {/* Strictly 2 Clean Selectable Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSelectedDisambiguationOption('option_a')}
                className={`rounded-2xl p-5 text-right border-2 transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  selectedDisambiguationOption === 'option_a'
                    ? 'bg-[#FAF6F0] border-[#D8755B] shadow-sm'
                    : 'bg-[#F7F2E9]/60 border-[#B98A78]/40 hover:border-[#B98A78]'
                }`}
              >
                <span className="text-base font-display font-bold text-[#252321]">
                  شبه الجزيرة العربية والخليج
                </span>
                <span
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    selectedDisambiguationOption === 'option_a'
                      ? 'border-[#D8755B]'
                      : 'border-[#B98A78]'
                  }`}
                >
                  {selectedDisambiguationOption === 'option_a' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D8755B]" />
                  )}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDisambiguationOption('option_b')}
                className={`rounded-2xl p-5 text-right border-2 transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  selectedDisambiguationOption === 'option_b'
                    ? 'bg-[#FAF6F0] border-[#D8755B] shadow-sm'
                    : 'bg-[#F7F2E9]/60 border-[#B98A78]/40 hover:border-[#B98A78]'
                }`}
              >
                <span className="text-base font-display font-bold text-[#252321]">
                  بلاد الشام ووادي الفرات
                </span>
                <span
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    selectedDisambiguationOption === 'option_b'
                      ? 'border-[#D8755B]'
                      : 'border-[#B98A78]'
                  }`}
                >
                  {selectedDisambiguationOption === 'option_b' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D8755B]" />
                  )}
                </span>
              </button>
            </div>

            {/* Primary Action: متابعة ← */}
            <div className="pt-2 space-y-3">
              <button
                type="button"
                onClick={handleConfirmDisambiguationSelection}
                className="w-full py-3.5 px-6 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white font-display font-bold text-base flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
              >
                <span>متابعة ←</span>
              </button>

              {/* Quiet Secondary Button: لست متأكداً */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleNotSureDisambiguation}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-[#252321]/65 hover:text-[#252321] hover:bg-[#EDE6DA]/60 transition-colors cursor-pointer"
                >
                  لست متأكداً
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* STAGE C: Inspection & Disambiguation Complete -> Account Preservation Card */
          <div className="rounded-3xl bg-white border border-[#B98A78]/50 p-6 sm:p-10 shadow-2xl space-y-6">
            {isMatched ? (
              <div className="rounded-2xl border-2 border-[#D8755B]/60 bg-gradient-to-r from-[#FAF6F0] via-white to-[#FAF6F0] p-5 sm:p-6 shadow-xs text-right relative overflow-hidden">
                <div className="absolute top-0 right-0 w-2.5 h-full bg-[#D8755B]" />
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#D8755B] text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-lg sm:text-xl font-display font-extrabold text-[#252321]">
                      تم العثور على سجل نسبي موثق لعائلة ({form.familyName})
                    </h2>
                    <p className="text-xs sm:text-sm text-[#252321]/80 leading-relaxed">
                      أكمل حفظ حسابك بالأسفل للانتقال إلى لوحة التحكم واستعراض نتيجة البحث.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#B98A78]/50 bg-[#FAF6F0] p-5 sm:p-6 shadow-xs text-right relative overflow-hidden">
                <div className="absolute top-0 right-0 w-2.5 h-full bg-[#D8755B]" />
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#252321] text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Search className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-lg sm:text-xl font-display font-extrabold text-[#252321]">
                      تم تسجيل طلب البحث لعائلة ({form.familyName})
                    </h2>
                    <p className="text-xs sm:text-sm text-[#252321]/80 leading-relaxed">
                      أكمل حفظ حسابك بالأسفل لمتابعة حالة الطلب في لوحة التحكم.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Card: تأكيد وحفظ الاكتشاف */}
            <div className="bg-[#F7F2E9] border border-[#B98A78]/40 rounded-2xl p-6 sm:p-8 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#B98A78]/25 pb-4">
                <div className="text-right">
                  <span className="text-xs font-display font-bold text-[#D8755B]">
                    بطاقة تأكيد وحفظ الاكتشاف
                  </span>
                  <h3 className="text-base sm:text-lg font-display font-bold text-[#252321]">
                    احفظ هذا الاكتشاف باسمك وانتقل فوراً إلى لوحة التحكم:
                  </h3>
                </div>

                {/* Toggle between Password or 4-digit OTP */}
                <div className="inline-flex rounded-xl bg-[#EDE6DA] p-1 border border-[#B98A78]/35 self-start">
                  <button
                    type="button"
                    onClick={() => setAuthMode('password')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-colors cursor-pointer ${
                      authMode === 'password'
                        ? 'bg-[#252321] text-white'
                        : 'text-[#252321]/75 hover:text-[#252321]'
                    }`}
                  >
                    كلمة مرور
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('otp')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-colors cursor-pointer ${
                      authMode === 'otp'
                        ? 'bg-[#D8755B] text-white'
                        : 'text-[#252321]/75 hover:text-[#252321]'
                    }`}
                  >
                    رمز تحقق (OTP)
                  </button>
                </div>
              </div>

              {/* Google Fast Preserve One-Click */}
              <button
                type="button"
                onClick={onGoogleSignInPreserve}
                className="w-full py-2.5 px-4 rounded-xl bg-white border border-[#B98A78]/40 hover:bg-[#FAF6EE] text-[#252321] font-semibold text-xs sm:text-sm flex items-center justify-center gap-3 transition-colors shadow-2xs cursor-pointer"
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
                <span>المتابعة السريعة وحفظ الاكتشاف بحساب Google</span>
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#B98A78]/30" />
                <span className="text-[11px] text-[#252321]/50 font-medium">
                  أو بالبريد الإلكتروني {authMode === 'otp' ? 'ورمز OTP الفوري' : 'وكلمة المرور'}
                </span>
                <div className="flex-1 h-px bg-[#B98A78]/30" />
              </div>

              <form onSubmit={handleSubmitPreservation} className="space-y-4" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Email Input */}
                  <div>
                    <label
                      htmlFor="gate-email"
                      className="block text-xs font-semibold text-[#252321] mb-1.5"
                    >
                      البريد الإلكتروني *
                    </label>
                    <div className="relative">
                      <input
                        id="gate-email"
                        type="email"
                        dir="ltr"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full rounded-xl bg-white border border-[#B98A78]/55 px-3.5 py-2.5 pl-9 text-right text-sm text-[#252321] focus:outline-none focus:border-[#D8755B]"
                      />
                      <Mail
                        className="w-4 h-4 text-[#B98A78] absolute left-3 top-1/2 -translate-y-1/2"
                        aria-hidden="true"
                      />
                    </div>
                    {formErrors.email && (
                      <p className="mt-1 text-xs text-red-700 font-medium">
                        {formErrors.email}
                      </p>
                    )}
                  </div>

                  {/* Password OR 4-Digit Demo OTP Input */}
                  {authMode === 'password' ? (
                    <div>
                      <label
                        htmlFor="gate-password"
                        className="block text-xs font-semibold text-[#252321] mb-1.5"
                      >
                        كلمة المرور لحماية سجلك *
                      </label>
                      <div className="relative">
                        <input
                          id="gate-password"
                          type="password"
                          dir="ltr"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full rounded-xl bg-white border border-[#B98A78]/55 px-3.5 py-2.5 pl-9 text-right text-sm text-[#252321] focus:outline-none focus:border-[#D8755B]"
                        />
                        <Lock
                          className="w-4 h-4 text-[#B98A78] absolute left-3 top-1/2 -translate-y-1/2"
                          aria-hidden="true"
                        />
                      </div>
                      {formErrors.password && (
                        <p className="mt-1 text-xs text-red-700 font-medium">
                          {formErrors.password}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          htmlFor="gate-otp"
                          className="block text-xs font-semibold text-[#252321]"
                        >
                          رمز التحقق البريدي (OTP) *
                        </label>
                        <button
                          type="button"
                          disabled={isSendingOtp}
                          onClick={handleSendRealOtpEmail}
                          className="text-[11px] font-display font-bold text-[#D8755B] hover:underline cursor-pointer disabled:opacity-50"
                        >
                          {isSendingOtp
                            ? 'جاري الإرسال عبر Resend...'
                            : 'إرسال رمز OTP إلى بريدي ←'}
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          id="gate-otp"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          dir="ltr"
                          value={otpCode}
                          onChange={(e) =>
                            setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                          }
                          placeholder="أدخل الرمز المرسل لبريدك"
                          className="w-full rounded-xl bg-white border border-[#B98A78]/55 px-3.5 py-2.5 pl-9 text-center font-mono font-bold tracking-widest text-sm text-[#252321] focus:outline-none focus:border-[#D8755B]"
                        />
                        <KeyRound
                          className="w-4 h-4 text-[#D8755B] absolute left-3 top-1/2 -translate-y-1/2"
                          aria-hidden="true"
                        />
                      </div>
                      {otpSentNotice && (
                        <p className="mt-1 text-[11px] text-emerald-800 font-semibold">
                          {otpSentNotice}
                        </p>
                      )}
                      {formErrors.password && (
                        <p className="mt-1 text-xs text-red-700 font-medium">
                          {formErrors.password}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Terms Checkbox */}
                <div className="pt-1">
                  <label className="inline-flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-1 w-4 h-4 accent-[#D8755B] rounded cursor-pointer"
                    />
                    <span className="text-xs text-[#252321]/85 leading-relaxed">
                      أوافق على شروط الاستخدام وسياسة الخصوصية وميثاق حفظ الأنساب وتوثيق السجلات في منصة جذوري
                    </span>
                  </label>
                  {formErrors.agreedToTerms && (
                    <p className="mt-1 text-xs text-red-700 font-medium">
                      {formErrors.agreedToTerms}
                    </p>
                  )}
                </div>

                {formErrors.form && (
                  <p
                    role="alert"
                    className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5"
                  >
                    {formErrors.form}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-3.5 px-6 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white font-display font-extrabold text-base flex items-center justify-center gap-2.5 transition-colors shadow-md cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>جاري حفظ الاكتشاف وفتح لوحة عمود النسب...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>تأكيد وحفظ الاكتشاف والانتقال إلى لوحة التحكم</span>
                      <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* 3. Footer */}
      <footer className="border-t border-[#B98A78]/25 py-6 bg-[#EDE6DA]/50 text-center text-xs text-[#252321]/70">
        منصة جذوري الرقمية للأنساب والإرث العائلي العربي — جميع البيانات مشفرة ومحفوظة وفق معايير الخصوصية.
      </footer>
    </div>
  );
};
