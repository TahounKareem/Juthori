import React, { useEffect, useState } from 'react';
import {
  Check,
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
import {
  ANNUAL_BILLING_SAVINGS_PERCENT,
  BillingCycle,
  SUBSCRIPTION_PLANS,
  SubscriptionPlanId,
  formatPlanPriceUsd,
  getPlanPriceUsd,
  getPlanRank,
  getRequiredPlanForFeature,
} from '../config/subscriptionPlans';

export type UpgradeActionFeatureKey =
  | 'lineage_connection'
  | 'kashafi'
  | 'customer_support'
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
  | 'community_event'
  | 'site_enrichment_review';

export interface UpgradePromptRequest {
  feature: UpgradeActionFeatureKey;
  requiredTier?: 'basic' | 'premium';
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
  currentPlanId?: SubscriptionPlanId;
  isCharterSigned: boolean;
  onClose: () => void;
  onStartVipCheckout: () => void;
  onSelectPlanCheckout?: (
    planId: 'basic' | 'premium',
    billingCycle: BillingCycle
  ) => void;
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
    requiresCharter?: boolean;
  }
> = {
  lineage_connection: {
    eyebrow: 'البحث عن ربط الجذور — عمود نسبي',
    title: 'افتح البحث الكامل عن ربط الجذور وعمود النسب الموثّق لعائلتك',
    description:
      'رقِّ عضويتك إلى باقة Basic أو Premium لاستعراض ربط عائلتك بالمصادر التاريخية، وكشف المحطات القبلية وعمود النسب الموثّق.',
    highlights: [
      'فتح البحث الكامل عن ربط الجذور وعرض عمود النسب الموثّق',
      `توسيع سعة شجرتي وخزانتي لتجاوز الحد المجاني (${SUBSCRIPTION_PLANS.free.limits.maxTreeNodes} فرد / ${SUBSCRIPTION_PLANS.free.limits.maxVaultItems} مقتنىً)`,
      'تفعيل خدمة العملاء المباشرة لمساندتك في التوثيق',
    ],
  },
  kashafi: {
    eyebrow: 'كشّافي (My Discoveries) — حصري لباقة Premium',
    title: 'اكتشف ما وراء شجرة عائلتك عبر باقة Premium',
    description:
      'باقة Premium تفتح لك «كشّافي» للوصول إلى معلومات عائلية أعمق، ومصادر ومراجع، ووثائق تاريخية، وقصص وسير، واكتشافات مستمرة تبعاً لتوفر المصادر.',
    highlights: [
      'الوصول الكامل إلى «كشّافي» والمصادر والمراجع والوثائق التاريخية',
      'تفعيل نشر موقع العائلة المستقل «موقعي» فور استيفاء الميثاق والحد الأدنى',
      'يشمل جميع مزايا باقة Basic (ربط الجذور، الشجرة والخزانة الموسّعة، خدمة العملاء)',
    ],
  },
  customer_support: {
    eyebrow: 'خدمة العملاء المباشرة — باقة Basic وما فوق',
    title: 'تواصل مباشرة مع فريق خدمة العملاء في جذوري',
    description:
      'تتوفر خدمة العملاء المباشرة بدءاً من باقة Basic، إلى جانب فتح ربط الجذور وتوسيع سعة شجرتي وخزانتي.',
    highlights: [
      'دعم مباشر من فريق جذوري لإرشادك في التوثيق وإدارة السجل',
      'فتح البحث الكامل عن ربط الجذور وعمود النسب الموثّق',
      'توسيع سعة شجرتي وخزانتي بما يتجاوز الحد المجاني',
    ],
  },
  tree_add_relative: {
    eyebrow: 'توسيع مشجرة العائلة — شجرتي',
    title: `وسّع شجرة عائلتك وتجاوز الحد المجاني (${SUBSCRIPTION_PLANS.free.limits.maxTreeNodes} فرد)`,
    description: `تتيح لك الباقة المجانية بناء شجرتك حتى ${SUBSCRIPTION_PLANS.free.limits.maxTreeNodes} فرد مجاناً. للانتقال إلى السعة الموسّعة والتصدير والطباعة، اختر باقة Basic أو Premium.`,
    highlights: [
      `تجاوز حد ${SUBSCRIPTION_PLANS.free.limits.maxTreeNodes} فرد في شجرتي وإضافة الأجيال والفروع بحرية`,
      'تصدير وطباعة المشجرة بجودة فائقة الدقة للمجالس العائلية',
      'فتح ربط الجذور وخدمة العملاء المباشرة ضمن الباقة',
    ],
  },
  tree_export: {
    eyebrow: 'التصدير والطباعة الفاخرة — شجرتي',
    title: 'رقِّ عضويتك لتصدير وطباعة شجرة عائلتك بجودة عالية',
    description:
      'احفظ مشجرة العائلة كلوحة فنية عالية الدقة (PNG / PDF) جاهزة للطباعة والمجالس العائلية، متاحة بدءاً من باقة Basic.',
    highlights: [
      'تصدير بجودة طباعة عالية وأحجام لوحات جدارية جاهزة',
      'ختم التوثيق الرقمي وهوية العائلة المعتمدة',
      'توسيع سعة شجرتي وخزانتي مع فتح ربط الجذور',
    ],
  },
  tree_invite: {
    eyebrow: 'مشاركة المشجرة ودعوة الأهل',
    title: 'شارك شجرة عائلتك ووسّع التوثيق مع أقاربك',
    description:
      'اختر باقة Basic أو Premium لفتح التصدير وربط الجذور، أو ترقَّ إلى Premium لإطلاق بوابة عائلتك ومجتمعك العائلي بالكامل.',
    highlights: [
      'توسيع شجرتي وخزانتي وتفعيل التصدير والطباعة',
      'فتح البحث الكامل عن ربط الجذور وعمود النسب',
      'باقة Premium تضيف «كشّافي» ونشر بوابة «موقعي» المستقلة',
    ],
  },
  vault_upload: {
    eyebrow: 'توسيع خزانة ذاكرة العائلة — خزانتي',
    title: `وسّع خزانة عائلتك وتجاوز الحد المجاني (${SUBSCRIPTION_PLANS.free.limits.maxVaultItems} مقتنىً)`,
    description: `تتيح لك الباقة المجانية حفظ حتى ${SUBSCRIPTION_PLANS.free.limits.maxVaultItems} صورة ووثيقة مجاناً. لتوسيع السعة والاستفادة من ربط الجذور وخدمة العملاء، اختر Basic أو Premium.`,
    highlights: [
      `تجاوز حد ${SUBSCRIPTION_PLANS.free.limits.maxVaultItems} مقتنىً لحفظ كافة صور ووثائق ومخطوطات العائلة`,
      'عزل وخصوصية تامة لمقتنيات عائلتك مع نسخ سحابي آمن',
      'ربط المقتنيات بأفراد الشجرة وبوابة العائلة (في Premium)',
    ],
  },
  vault_create_folder: {
    eyebrow: 'تنظيم خزانة العائلة — المجلدات الخاصة',
    title: 'وسّع خزانتك وأنشئ مجلدات أرشفة مخصصة لعائلتك',
    description:
      'رتّب ذاكرة عائلتك في مجلدات مصنفة حسب الفروع والحقب الزمنية والوثائق الرسمية مع سعة موسّعة في Basic وPremium.',
    highlights: [
      'تنظيم غير محدود للمجلدات المصنفة حسب الفروع والمناسبات',
      'سعة خزانة موسّعة (حتى بلا حدود في باقة Premium)',
      'تزامن فوري بين الخزانة والمشجرة',
    ],
  },
  site_publish: {
    eyebrow: 'نشر البوابة الرقمية المستقلة — موقعي (Premium)',
    title: 'رقِّ إلى باقة Premium ووقّع ميثاق أمين السجل لنشر موقع عائلتك',
    description:
      'تعديلاتك وتصميماتك في الاستوديو محفوظة بالكامل؛ يتاح نشر موقع العائلة المستقل ضمن باقة Premium فور استيفاء ميثاق النشر والحد الأدنى من البيانات.',
    highlights: [
      'رابط رسمي دائم ومستقل لبوابة العائلة الإلكترونية',
      'تحكم كامل بالخصوصية والرمز السري وترتيب أقسام الموقع',
      'يشمل «كشّافي» وربط الجذور وسعات شجرتي وخزانتي الموسّعة',
    ],
    requiresCharter: true,
  },
  site_qr: {
    eyebrow: 'بطاقة الدعوة ورمز QR لبوابة العائلة — Premium',
    title: 'فعّل باقة Premium وميثاق أمين السجل لإصدار بطاقة الدعوة وQR',
    description:
      'أصدر بطاقة دعوة رقمية ورمز QR جاهز للمشاركة في المجالس والمناسبات لفتح بوابة عائلتك بضغطة واحدة.',
    highlights: [
      'بطاقة دعوة مصممة بهوية العائلة جاهزة للطباعة والواتساب',
      'رمز QR مرتبط مباشرة ببوابة العائلة المنشورة',
      'يشمل جميع مزايا باقة Premium وكشّافي',
    ],
    requiresCharter: true,
  },
  community_invite: {
    eyebrow: 'دائرة الأقارب والتواصل العائلي — بدءاً من Basic',
    title: 'رقِّ إلى باقة Basic لإرسال دعوات رسمية لأقاربك وإدارة دائرة العائلة',
    description:
      'ابنِ دائرة رحم عائلتك وادعُ الأقارب للانضمام والمشاركة في التوثيق وتبادل الذكريات بدءاً من الباقة الأساسية (Basic) أو المميزة (Premium).',
    highlights: [
      'إرسال دعوات رسمية موثقة للأقارب عبر البريد والروابط الخاصة',
      'ربط كل قريب بموقعه المباشر داخل شجرة العائلة وتحديد صلاحياته',
      'يشمل فتح ربط الجذور وتوسيع شجرتي وخزانتي وخدمة العملاء المباشرة',
    ],
  },
  community_qr: {
    eyebrow: 'بطاقة دعوة دائرة العائلة ورمز QR — بدءاً من Basic',
    title: 'رقِّ إلى باقة Basic لإصدار بطاقة دعوة دائرة العائلة ورمز QR',
    description:
      'شارك بطاقة الدعوة الرسمية مع أقاربك لربطهم بدائرة عائلتك بضغطة واحدة، متاحة بدءاً من الباقة الأساسية (Basic).',
    highlights: [
      'بطاقة فاخرة مع رمز QR مباشر للانضمام لدائرة العائلة',
      'إدارة فورية لقائمة الأقارب المنضمين وصلاحياتهم',
      'توسيع سعة الشجرة والخزانة وفتح ربط الجذور وخدمة العملاء',
    ],
  },
  community_quest: {
    eyebrow: 'حملات ذاكرة العائلة — بدءاً من Basic',
    title: 'رقِّ إلى باقة Basic لإطلاق حملات جمع صور وذكريات العائلة',
    description:
      'أطلق حملة جمع صور وذكريات الأجداد ليشارك فيها أفراد العائلة وتُحفظ في أرشيفكم، متاحة بدءاً من باقة Basic.',
    highlights: [
      'إطلاق حملات توثيق لجمع الصور والقصص النادرة من الأقارب',
      'مشاركة نداء التوثيق مباشرة في مجموعات العائلة وواتساب',
      'حفظ المقتنيات بسعة موسّعة في خزانتي مع ربط الجذور',
    ],
  },
  community_event: {
    eyebrow: 'المناسبات العائلية وصلة الرحم — بدءاً من Basic',
    title: 'رقِّ إلى باقة Basic لإنشاء مناسبة عائلية وتتبع تأكيدات الحضور',
    description:
      'نظّم اللقاءات السنوية والمناسبات العائلية وأرسل الدعوات الرسمية وتتبع تأكيدات الحضور، متاحة بدءاً من باقة Basic.',
    highlights: [
      'إنشاء مناسبات واجتماعات عائلية مع الموقع والتوقيت التفصيلي',
      'تأكيد حضور الأقارب ومتابعة القائمة لحظياً',
      'فتح ربط الجذور وسعة موسّعة لشجرتي وخزانتي',
    ],
  },
  site_enrichment_review: {
    eyebrow: 'مراجعة مقترحات إثراء موقع العائلة — حصري لباقة Premium',
    title: 'رقِّ إلى باقة Premium لمراجعة واعتماد مقترحات الإثراء الواردة لموقع الديوان',
    description:
      'إدارة واعتماد مقترحات الإثراء الواردة من زوار وأقارب موقع عائلتك المنشور ودمجها مباشرة في السجل متاحة حصرياً ضمن باقة Premium.',
    highlights: [
      'مراجعة واعتماد مقترحات إضافة الأفراد والصور والقصص الواردة من موقع العائلة',
      'نشر وتفعيل موقع العائلة المستقل «موقعي» برابط دائم',
      'الوصول الكامل إلى «كشّافي» والمصادر والوثائق التاريخية',
    ],
  },
};

export const UpgradeToPremiumModal: React.FC<UpgradeToPremiumModalProps> = ({
  isOpen,
  request,
  familyName,
  isVip,
  currentPlanId,
  isCharterSigned,
  onClose,
  onStartVipCheckout,
  onSelectPlanCheckout,
  onConfirmCharterSignature,
  onOpenFullContractModal,
}) => {
  const effectivePlanId: SubscriptionPlanId =
    currentPlanId ?? (isVip ? 'premium' : 'free');
  const requiredPlan: 'basic' | 'premium' = request
    ? (request.requiredTier ?? getRequiredPlanForFeature(request.feature))
    : 'premium';

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium'>(
    requiredPlan
  );
  const [consentChecked, setConsentChecked] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signError, setSignError] = useState('');

  useEffect(() => {
    if (!isOpen || !request) return;
    const reqPlan =
      request.requiredTier ?? getRequiredPlanForFeature(request.feature);
    if (effectivePlanId === 'basic' || reqPlan === 'premium') {
      setSelectedPlan('premium');
    } else {
      setSelectedPlan('basic');
    }
    setSignError('');
  }, [isOpen, request, effectivePlanId]);

  if (!isOpen || !request) return null;

  const meta = FEATURE_DEFAULTS[request.feature];
  const headline = request.title || meta.title;
  const description = request.description || meta.description;
  const hasSufficientPlan =
    getPlanRank(effectivePlanId) >= getPlanRank(requiredPlan);
  const needsCharterStep = Boolean(meta.requiresCharter) && !isCharterSigned;
  const currentStep: 1 | 2 = !hasSufficientPlan ? 1 : 2;
  const cleanFamily = familyName?.trim() || 'عائلتك';

  const canChooseBasic =
    requiredPlan === 'basic' && effectivePlanId === 'free';
  const selectablePlans: Array<'basic' | 'premium'> = canChooseBasic
    ? ['basic', 'premium']
    : ['premium'];

  const isBasicSteppingUpToPremium =
    effectivePlanId === 'basic' && requiredPlan === 'premium';
  const monthlyStepUpDiffUsd = Number(
    (
      SUBSCRIPTION_PLANS.premium.monthlyPriceUsd -
      SUBSCRIPTION_PLANS.basic.monthlyPriceUsd
    ).toFixed(2)
  );
  const annualStepUpDiffUsd = Number(
    (
      SUBSCRIPTION_PLANS.premium.annualPriceUsd -
      SUBSCRIPTION_PLANS.basic.annualPriceUsd
    ).toFixed(2)
  );

  const activePlanDef = SUBSCRIPTION_PLANS[selectedPlan];
  const activePriceUsd = getPlanPriceUsd(selectedPlan, billingCycle);

  const handleCheckoutNow = () => {
    if (onSelectPlanCheckout) {
      onSelectPlanCheckout(selectedPlan, billingCycle);
    } else {
      onStartVipCheckout();
    }
  };

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
      <div className="w-full max-w-2xl rounded-3xl bg-[#F5F1E8] border border-[#D8C7B2] shadow-[0_28px_70px_-20px_rgba(31,31,28,0.28)] overflow-hidden my-auto">
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

          {/* Optional 2-Step Stepper when Registrar Charter is also required */}
          {meta.requiresCharter && (
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div
                className={`rounded-2xl px-3.5 py-2.5 border flex items-center gap-2.5 transition-colors ${
                  hasSufficientPlan
                    ? 'bg-[#FAF7F2] border-[#D97757]/50'
                    : 'bg-[#FAF7F2] border-[#D97757] shadow-xs'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-[#D97757] text-[#F5F1E8] flex items-center justify-center text-xs font-mono font-bold shrink-0">
                  {hasSufficientPlan ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    '1'
                  )}
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-display font-extrabold text-[#1F1F1C] truncate">
                    تفعيل باقة {SUBSCRIPTION_PLANS[requiredPlan].code}
                  </div>
                  <div className="text-[10px] font-bold text-[#D97757] tabular-nums">
                    {hasSufficientPlan
                      ? 'مفعّلة بنجاح ✓'
                      : `بدءاً من ${formatPlanPriceUsd(
                          SUBSCRIPTION_PLANS[requiredPlan].monthlyPriceUsd
                        )}/شهر`}
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
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 bg-[#F5F1E8]">
          {currentStep === 1 ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs sm:text-sm text-[#1F1F1C]/85 leading-relaxed font-medium flex-1">
                  {description}
                </p>

                {/* Monthly / Annual Billing Toggle */}
                <div
                  role="group"
                  aria-label="دورة الدفع"
                  className="inline-flex items-center p-1 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] self-start sm:self-center shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      billingCycle === 'monthly'
                        ? 'bg-[#FDFBF7] text-[#1F1F1C] border border-[#D8C7B2]'
                        : 'text-[#1F1F1C]/70 hover:text-[#1F1F1C]'
                    }`}
                  >
                    شهري
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('annual')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      billingCycle === 'annual'
                        ? 'bg-[#D97757] text-[#F5F1E8]'
                        : 'text-[#1F1F1C]/75 hover:text-[#1F1F1C]'
                    }`}
                  >
                    سنوي · وفّر {ANNUAL_BILLING_SAVINGS_PERCENT}%
                  </button>
                </div>
              </div>

              {/* Step-up difference callout for Basic subscribers moving to Premium */}
              {isBasicSteppingUpToPremium && (
                <div className="rounded-2xl bg-[#FAF7F2] border border-[#D97757]/55 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="font-display font-bold text-[#1F1F1C]">
                    أنت مشترك حالياً في الباقة الأساسية (Basic) — يمكنك الترقية إلى Premium بفارق بسيط فقط:
                  </div>
                  <div
                    dir="ltr"
                    className="font-display font-extrabold text-[#D97757] tabular-nums"
                  >
                    +
                    {formatPlanPriceUsd(
                      billingCycle === 'annual'
                        ? annualStepUpDiffUsd
                        : monthlyStepUpDiffUsd
                    )}{' '}
                    {billingCycle === 'annual' ? '/ سنة' : '/ شهر'}
                  </div>
                </div>
              )}

              {/* Selectable Plan Cards (Basic & Premium, or Premium only) */}
              <div
                className={`grid grid-cols-1 ${
                  selectablePlans.length > 1 ? 'sm:grid-cols-2' : ''
                } gap-3.5`}
              >
                {selectablePlans.map((pid) => {
                  const p = SUBSCRIPTION_PLANS[pid];
                  const isSelected = selectedPlan === pid;
                  const price = getPlanPriceUsd(pid, billingCycle);
                  const isReq = requiredPlan === pid;

                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => setSelectedPlan(pid)}
                      className={`text-right rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#FDFBF7] border-2 border-[#D97757] shadow-xs'
                          : 'bg-[#FAF7F2] border-[#D8C7B2] hover:border-[#D97757]/60'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-display font-extrabold text-[#D97757]">
                            {p.code} · {p.nameAr}
                          </span>
                          <span
                            className={`text-[11px] font-display font-bold ${
                              isReq ? 'text-[#D97757]' : 'text-[#1F1F1C]/70'
                            }`}
                          >
                            {isReq
                              ? pid === 'basic'
                                ? 'الخيار الأنسب لهذه الميزة'
                                : 'الباقة المطلوبة لهذه الميزة'
                              : 'للتغطية الشاملة مع كشّافي وموقعي'}
                          </span>
                        </div>

                        <div className="flex items-baseline gap-1.5">
                          <span
                            dir="ltr"
                            className="text-2xl font-display font-extrabold text-[#1F1F1C] tabular-nums"
                          >
                            {formatPlanPriceUsd(price)}
                          </span>
                          <span className="text-xs text-[#1F1F1C]/65">
                            {billingCycle === 'annual' ? '/ سنة' : '/ شهر'}
                          </span>
                        </div>

                        {billingCycle === 'annual' && (
                          <div className="text-[11px] font-medium text-[#D97757] tabular-nums">
                            ~${p.annualMonthlyEquivalentUsd.toFixed(2)} / شهرياً · توفير{' '}
                            {p.annualSavingsPercent}%
                          </div>
                        )}

                        <p className="text-[11.5px] text-[#1F1F1C]/80 leading-relaxed pt-1">
                          {p.taglineAr}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-[#D8C7B2]/60 flex items-center justify-between text-[11px] font-display font-bold">
                        <span
                          className={
                            isSelected ? 'text-[#D97757]' : 'text-[#1F1F1C]/60'
                          }
                        >
                          {isSelected ? 'الباقة المختارة ✓' : 'اضغط لاختيار هذه الباقة'}
                        </span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-[#D97757]" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

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

              {/* Primary CTA */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleCheckoutNow}
                  className="w-full sm:flex-1 py-3.5 px-5 rounded-2xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs sm:text-sm font-display font-extrabold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Crown className="w-4 h-4 shrink-0" />
                  <span>
                    الترقية إلى {activePlanDef.code} (
                    {formatPlanPriceUsd(activePriceUsd)}
                    {billingCycle === 'annual' ? '/سنة' : '/شهر'})
                    {needsCharterStep ? ' ومتابعة التوقيع' : ''}
                  </span>
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
                        خطوة واحدة لتفعيل صلاحيات النشر والدعوة الرسمية فوراً
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

export const SubscriptionUpgradeModal = UpgradeToPremiumModal;
