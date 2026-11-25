import React, { useState } from 'react';
import {
  CheckCircle2,
  Crown,
  FileSignature,
  Loader2,
  ScrollText,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { RECORD_KEEPER_CONTRACT_METADATA } from '../data/recordKeeperContractData';
import type { LegalAuditTrailEntry } from '../services/firestoreService';

export type UpgradeActionFeatureKey =
  | 'tree_add_relative'
  | 'tree_export'
  | 'tree_invite'
  | 'vault_upload'
  | 'vault_create_folder'
  | 'site_publish'
  | 'site_qr'
  | 'community_invite'
  | 'community_qr'
  | 'community_quest'
  | 'community_event';

export interface UpgradePromptRequest {
  feature: UpgradeActionFeatureKey;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAuthorizedContinue?: () => void;
}

interface UpgradeToPremiumModalProps {
  isOpen: boolean;
  request: UpgradePromptRequest | null;
  familyName: string;
  isVip: boolean;
  isCharterSigned: boolean;
  onClose: () => void;
  onStartVipCheckout: () => void;
  onConfirmCharterSignature: () => Promise<LegalAuditTrailEntry>;
  onOpenFullContractModal: () => void;
}

const FEATURE_DEFAULTS: Record<
  UpgradeActionFeatureKey,
  {
    eyebrow: string;
    title: string;
    description: string;
    highlights: string[];
  }
> = {
  tree_add_relative: {
    eyebrow: 'توسيع مشجرة العائلة — عضوية بريميوم وأمين السجل',
    title:
      'رقِّ عضويتك إلى بريميوم ووقّع ميثاق أمين السجل للبدء في بناء وتوسيع شجرة عائلتك',
    description:
      'بعد الترقية واعتماد ميثاق أمين السجل ستُفتح لك مباشرة نافذة إضافة الأقارب لتوثيق الآباء والأبناء والفروع وربطهم بعمود النسب.',
    highlights: [
      'إضافة الأفراد والفروع والزوجات وتخصيص مظهر المشجرة بالكامل',
      'التوثيق الرسمي بصفة «أمين سجل العائلة» مع شهادة ميثاق إلكترونية',
      'هدية فورية بقيمة $20 رصيد في المحفظة الرقمية ضمن الاشتراك السنوي',
    ],
  },
  tree_export: {
    eyebrow: 'التصدير والطباعة الفاخرة — شجرتي',
    title:
      'رقِّ عضويتك إلى بريميوم ووقّع ميثاق أمين السجل لتصدير وطباعة شجرة عائلتك',
    description:
      'احفظ مشجرة العائلة كلوحة فنية فائقة الدقة (PNG / PDF) جاهزة للطباعة والمجالس العائلية بختم منصة جذوري.',
    highlights: [
      'تصدير بجودة طباعة عالية وأحجام لوحات جدارية جاهزة',
      'ختم التوثيق الرقمي وهوية العائلة المعتمدة',
      'إمكانية التصدير غير المحدود بعد كل تحديث في الشجرة',
    ],
  },
  tree_invite: {
    eyebrow: 'مشاركة المشجرة ودعوة الأهل',
    title:
      'رقِّ عضويتك إلى بريميوم ووقّع ميثاق أمين السجل لمشاركة الشجرة ودعوة أقاربك',
    description:
      'أنشئ روابط دعوة رسمية وبطاقات QR موثّقة ليطّلع أبناء العائلة على المشجرة ويشاركوا في إثرائها.',
    highlights: [
      'دعوات موثقة للأقارب بصلاحيات تحكم وخصوصية دقيقة',
      'بطاقة دعوة عائلية فاخرة مع رمز QR مباشر',
      'سجل كامل لأعضاء الدائرة المنضمين للمشجرة',
    ],
  },
  vault_upload: {
    eyebrow: 'خزانة ذاكرة العائلة — الأرشفة السحابية',
    title:
      'رقِّ عضويتك إلى بريميوم ووقّع ميثاق أمين السجل لرفع وحفظ صور ووثائق عائلتك',
    description:
      'احتفظ بصور الأجداد والمخطوطات والوثائق النادرة في خزانة مشفرة ومرتبطة بأفراد شجرة العائلة معزولة بالكامل لحسابك.',
    highlights: [
      'رفع الصور والوثائق والقصص التاريخية وربطها بأفراد الشجرة',
      'عزل وخصوصية تامة لمقتنيات عائلتك مع نسخ سحابي آمن',
      'إنشاء مجلدات وألبومات مخصصة لكل فرع أو مناسبة',
    ],
  },
  vault_create_folder: {
    eyebrow: 'تنظيم خزانة العائلة — المجلدات الخاصة',
    title:
      'رقِّ عضويتك إلى بريميوم ووقّع ميثاق أمين السجل لإنشاء مجلدات أرشفة مخصصة',
    description:
      'رتّب ذاكرة عائلتك في مجلدات مصنفة حسب الفروع والحقب الزمنية والوثائق الرسمية بمرونة كاملة.',
    highlights: [
      'إنشاء عدد مفتوح من المجلدات المصنفة لمقتنيات العائلة',
      'تحكم كامل بخصوصية المجلدات وإظهارها في موقع العائلة',
      'تزامن فوري بين الخزانة والمشجرة وموقع العائلة',
    ],
  },
  site_publish: {
    eyebrow: 'نشر البوابة الرقمية للعائلة — موقعي',
    title:
      'رقِّ عضويتك إلى بريميوم ووقّع ميثاق أمين السجل لنشر وتفعيل موقع عائلتك الإلكتروني',
    description:
      'تعديلاتك وتصميماتك محفوظة بالكامل؛ أكمل الترقية واعتماد الميثاق لإطلاق رابط موقع العائلة الرسمي للعالم والأقارب.',
    highlights: [
      'رابط رسمي دائم ومستقل لبوابة العائلة الإلكترونية',
      'تحكم كامل بالخصوصية والرمز السري وترتيب أقسام الموقع',
      'تحديثات فورية للمحتوى والصور والمشجرة التفاعلية',
    ],
  },
  site_qr: {
    eyebrow: 'بطاقة الدعوة ورمز QR لبوابة العائلة',
    title:
      'رقِّ عضويتك إلى بريميوم ووقّع ميثاق أمين السجل لإصدار بطاقة الدعوة ورمز QR',
    description:
      'أصدر بطاقة دعوة رقمية ورمز QR جاهز للمشاركة في المجالس والمناسبات لفتح بوابة عائلتك بضغطة واحدة.',
    highlights: [
      'بطاقة دعوة مصممة بهوية العائلة جاهزة للطباعة والواتساب',
      'رمز QR مرتبط مباشرة ببوابة العائلة أو الدعوة السرية',
      'تحكم كامل بتفعيل أو إيقاف الدعوات في أي وقت',
    ],
  },
  community_invite: {
    eyebrow: 'دائرة الرحم والتواصل العائلي — مجتمعي',
    title:
      'رقِّ عضويتك إلى بريميوم ووقّع ميثاق أمين السجل لإرسال دعوات رسمية لأقاربك',
    description:
      'ابنِ دائرة رحم عائلتك وادعُ الأقارب للانضمام والمشاركة في التوثيق وتبادل الذكريات ضمن بيئة موثوقة.',
    highlights: [
      'إرسال دعوات رسمية موثقة للأقارب عبر البريد والروابط الخاصة',
      'ربط كل قريب بموقعه المباشر داخل شجرة العائلة',
      'إدارة طلبات الانضمام وصلاحيات الإضافة بيد أمين السجل',
    ],
  },
  community_qr: {
    eyebrow: 'بطاقة دعوة دائرة العائلة ورمز QR',
    title:
      'رقِّ عضويتك إلى بريميوم ووقّع ميثاق أمين السجل لإصدار بطاقة دعوة الدائرة وQR',
    description:
      'شارك بطاقة الدعوة الرسمية مع أقاربك لربطهم بدائرة عائلتك واستعراض الشجرة والخزانة بسهولة.',
    highlights: [
      'بطاقة فاخرة مع رمز QR مباشر للانضمام لدائرة العائلة',
      'صلاحيات دخول مضبوطة ومحمية بهوية أمين السجل',
      'إدارة فورية لقائمة الأعضاء المنضمين لدائرة الرحم',
    ],
  },
  community_quest: {
    eyebrow: 'حملات ذاكرة العائلة — مجتمعي',
    title:
      'رقِّ عضويتك إلى بريميوم ووقّع ميثاق أمين السجل لإطلاق حملة ذاكرة عائلية',
    description:
      'أطلق حملة جمع صور وذكريات الأجداد ليشارك فيها جميع أفراد العائلة وتُحفظ تلقائياً في أرشيفكم.',
    highlights: [
      'إطلاق حملات توثيق لجمع الصور والقصص النادرة من الأقارب',
      'متابعة المساهمات الواردة واعتمادها قبل إضافتها للخزانة',
      'توثيق أسماء المساهمين في سجل شرف العائلة',
    ],
  },
  community_event: {
    eyebrow: 'المناسبات العائلية الرسمية — مجتمعي',
    title:
      'رقِّ عضويتك إلى بريميوم ووقّع ميثاق أمين السجل لإنشاء مناسبة عائلية رسمية',
    description:
      'نظّم اللقاءات السنوية والمناسبات العائلية وأرسل الدعوات الرسمية وتتبع تأكيدات الحضور من مكان واحد.',
    highlights: [
      'إنشاء مناسبات واجتماعات عائلية مع الموقع والتوقيت التفصيلي',
      'تأكيد حضور الأقارب ومتابعة القائمة لحظياً',
      'أرشفة صور وذكريات المناسبة مباشرة في خزانة العائلة',
    ],
  },
};

export const UpgradeToPremiumModal: React.FC<UpgradeToPremiumModalProps> = ({
  isOpen,
  request,
  familyName,
  isVip,
  isCharterSigned,
  onClose,
  onStartVipCheckout,
  onConfirmCharterSignature,
  onOpenFullContractModal,
}) => {
  const [consentChecked, setConsentChecked] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signError, setSignError] = useState('');

  if (!isOpen || !request) return null;

  const meta = FEATURE_DEFAULTS[request.feature];
  const headline = request.title || meta.title;
  const description = request.description || meta.description;
  const currentStep: 1 | 2 = !isVip ? 1 : 2;
  const cleanFamily = familyName?.trim() || 'عائلتك';

  const handleSignNow = async () => {
    if (!consentChecked || isSigning) return;
    setSignError('');
    setIsSigning(true);
    try {
      await onConfirmCharterSignature();
      const continueFn = request.onAuthorizedContinue;
      setConsentChecked(false);
      onClose();
      if (continueFn) {
        window.setTimeout(() => {
          continueFn();
        }, 120);
      }
    } catch (err) {
      setSignError(
        err instanceof Error
          ? err.message
          : 'تعذّر اعتماد التوقيع حالياً، يرجى المحاولة مرة أخرى.'
      );
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[125] bg-[#1F1F1C]/45 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-premium-modal-title"
    >
      <div className="w-full max-w-xl rounded-3xl bg-[#F5F1E8] border border-[#D8C7B2] shadow-[0_28px_70px_-20px_rgba(31,31,28,0.28)] overflow-hidden my-auto">
        {/* Warm Ivory & Soft Beige Top Header */}
        <div className="relative px-6 pt-6 pb-5 bg-[#E8DED2] border-b border-[#D8C7B2]">
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="absolute top-4 left-4 w-9 h-9 rounded-xl bg-[#F5F1E8] hover:bg-[#FAF7F2] border border-[#D8C7B2] text-[#1F1F1C] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 text-[11px] font-display font-bold text-[#D97757] mb-2">
            <Crown className="w-4 h-4 text-[#D97757] shrink-0" />
            <span>{meta.eyebrow}</span>
          </div>

          <h2
            id="upgrade-premium-modal-title"
            className="text-lg sm:text-xl font-display font-extrabold text-[#1F1F1C] leading-snug pl-10"
          >
            {headline}
          </h2>

          {/* 2-Step Journey Stepper (Premium VIP -> Registrar Charter) */}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div
              className={`rounded-2xl px-3.5 py-2.5 border flex items-center gap-2.5 transition-colors ${
                isVip
                  ? 'bg-[#FAF7F2] border-[#D97757]/50'
                  : 'bg-[#FAF7F2] border-[#D97757] shadow-xs'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                  isVip
                    ? 'bg-[#D97757] text-[#F5F1E8]'
                    : 'bg-[#D97757] text-[#F5F1E8]'
                }`}
              >
                {isVip ? <CheckCircle2 className="w-3.5 h-3.5" /> : '1'}
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-display font-extrabold text-[#1F1F1C] truncate">
                  عضوية بريميوم السنوية
                </div>
                <div className="text-[10px] font-bold text-[#D97757]">
                  {isVip ? 'مفعّلة بنجاح ✓' : '$60 / سنة (+ $20 هدية)'}
                </div>
              </div>
            </div>

            <div
              className={`rounded-2xl px-3.5 py-2.5 border flex items-center gap-2.5 transition-colors ${
                isCharterSigned
                  ? 'bg-[#FAF7F2] border-[#D97757]/50'
                  : currentStep === 2
                    ? 'bg-[#FAF7F2] border-[#D97757] shadow-xs'
                    : 'bg-[#F5F1E8]/80 border-[#D8C7B2]'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                  isCharterSigned || currentStep === 2
                    ? 'bg-[#D97757] text-[#F5F1E8]'
                    : 'bg-[#E8DED2] text-[#1F1F1C] border border-[#D8C7B2]'
                }`}
              >
                {isCharterSigned ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  '2'
                )}
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-display font-extrabold text-[#1F1F1C] truncate">
                  توقيع ميثاق أمين السجل
                </div>
                <div className="text-[10px] font-semibold text-[#1F1F1C]/70">
                  {isCharterSigned
                    ? 'تم الاعتماد ✓'
                    : currentStep === 2
                      ? 'الخطوة الأخيرة للتفعيل'
                      : 'مباشرة بعد الترقية'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 bg-[#F5F1E8]">
          {currentStep === 1 ? (
            <>
              <p className="text-xs sm:text-sm text-[#1F1F1C]/85 leading-relaxed font-medium">
                {description}
              </p>

              {/* Benefits List */}
              <div className="rounded-2xl bg-[#FAF7F2] border border-[#D8C7B2] p-4 space-y-2.5">
                <div className="text-xs font-display font-extrabold text-[#1F1F1C] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#D97757]" />
                  <span>ما ستحصل عليه فوراً لعائلة ({cleanFamily}):</span>
                </div>
                <ul className="space-y-2">
                  {meta.highlights.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-xs text-[#1F1F1C]/85 leading-relaxed"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#D97757] shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pricing Strip */}
              <div className="rounded-2xl bg-[#E8DED2] border border-[#D8C7B2] px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-display font-extrabold text-[#1F1F1C]">
                    باقة جذوري بريميوم السنوية + صفة أمين السجل
                  </div>
                  <div className="text-[11px] text-[#1F1F1C]/70 mt-0.5">
                    تشمل الشجرة والخزانة والموقع والمجتمع + بحث الأنساب المعمّق
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-xl font-mono font-extrabold text-[#D97757] leading-none">
                    $60
                    <span className="text-[11px] font-display font-bold text-[#1F1F1C]/70 mr-1">
                      / سنة
                    </span>
                  </div>
                </div>
              </div>

              {/* Primary CTA */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onStartVipCheckout}
                  className="w-full sm:flex-1 py-3.5 px-5 rounded-2xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs sm:text-sm font-display font-extrabold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Crown className="w-4 h-4 shrink-0" />
                  <span>الترقية الآن إلى بريميوم ($60/سنة) ومتابعة التوقيع ←</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto py-3.5 px-4 rounded-2xl bg-[#E8DED2] hover:bg-[#D8C7B2]/60 border border-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-bold transition-colors cursor-pointer"
                >
                  متابعة التصفح
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Step 2: Electronic Registrar Charter Signature */}
              <div className="rounded-2xl bg-[#FAF7F2] border border-[#D8C7B2] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
                      <FileSignature className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-display font-extrabold text-[#1F1F1C]">
                        اعتماد ميثاق أمين سجل عائلة ({cleanFamily})
                      </div>
                      <div className="text-[11px] text-[#1F1F1C]/70">
                        خطوة واحدة لتفعيل صلاحيات الإضافة والنشر والدعوة فوراً
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenFullContractModal}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E8DED2] hover:bg-[#D8C7B2]/60 border border-[#D8C7B2] text-[#1F1F1C] text-[11px] font-display font-bold transition-colors cursor-pointer"
                  >
                    <ScrollText className="w-3.5 h-3.5 text-[#D97757]" />
                    <span>قراءة العقد الكامل (29 مادة)</span>
                  </button>
                </div>

                <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/80 p-3 space-y-1.5 text-[11.5px] text-[#1F1F1C]/85 leading-relaxed">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#D97757] shrink-0 mt-0.5" />
                    <span>
                      التزام بأمانة توثيق بيانات عائلة ({cleanFamily}) واحترام خصوصية أفرادها وعدم إدراج معلومات غير صحيحة.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#D97757] shrink-0 mt-0.5" />
                    <span>
                      تُصدر لك شهادة اعتماد إلكترونية موثقة وتُحوَّل صفتك فوراً إلى «أمين سجل» مع الاحتفاظ بمكانك الحالي دون انقطاع.
                    </span>
                  </div>
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#E8DED2]/70 border border-[#D8C7B2] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => {
                      setConsentChecked(e.target.checked);
                      if (signError) setSignError('');
                    }}
                    className="mt-0.5 w-4 h-4 accent-[#D97757] rounded cursor-pointer shrink-0"
                  />
                  <span className="text-[11.5px] font-display font-bold text-[#1F1F1C] leading-relaxed">
                    {RECORD_KEEPER_CONTRACT_METADATA.finalConsentCheckboxLabel}
                  </span>
                </label>

                {signError && (
                  <div className="rounded-xl bg-[#E8DED2] border border-[#D97757] px-3.5 py-2 text-xs font-bold text-[#D97757]">
                    {signError}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  type="button"
                  disabled={!consentChecked || isSigning}
                  onClick={handleSignNow}
                  className={`w-full sm:flex-1 py-3.5 px-5 rounded-2xl text-xs sm:text-sm font-display font-extrabold transition-colors flex items-center justify-center gap-2 ${
                    consentChecked && !isSigning
                      ? 'bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] shadow-sm cursor-pointer'
                      : 'bg-[#E8DED2] text-[#1F1F1C]/45 border border-[#D8C7B2] cursor-not-allowed'
                  }`}
                >
                  {isSigning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري اعتماد التوقيع وتفعيل الصلاحيات...</span>
                    </>
                  ) : (
                    <>
                      <FileSignature className="w-4 h-4 shrink-0" />
                      <span>اعتماد التوقيع الإلكتروني وتفعيل «أمين سجل» فوراً ✓</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto py-3.5 px-4 rounded-2xl bg-[#E8DED2] hover:bg-[#D8C7B2]/60 border border-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-bold transition-colors cursor-pointer"
                >
                  لاحقاً
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
