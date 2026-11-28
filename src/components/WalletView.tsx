import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Crown,
  Gift,
  Mail,
  Receipt,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { auth } from '../services/firebase';
import {
  canonicalCustomerEmailUid,
  fetchUserWalletTransactions,
  WalletTransactionData,
} from '../services/firestoreService';
import { LineageSearchResult } from '../types/juthori';
import {
  AMBASSADOR_REWARDS_CONFIG,
  ANNUAL_BILLING_SAVINGS_PERCENT,
  BillingCycle,
  SUBSCRIPTION_PLANS,
  SubscriptionPlanId,
  formatPlanPriceUsd,
  getPlanPriceUsd,
} from '../config/subscriptionPlans';
import { SubscriptionPricingSection } from './SubscriptionPricingSection';

interface WalletViewProps {
  result: LineageSearchResult;
  userId?: string;
  userEmail: string;
  isVip: boolean;
  currentPlanId?: SubscriptionPlanId;
  billingCycle?: BillingCycle;
  ambassadorFreeMonths?: number;
  ambassadorCapacityBonus?: number;
  onUpgradeSuccess: () => void;
  onSelectPlanUpgrade?: (
    planId: 'basic' | 'premium',
    billingCycle: BillingCycle
  ) => void;
  onNavigateToAmbassador?: () => void;
  onLogActivity?: (action: string, detail: string) => void;
  emailVerified?: boolean;
  showEmailReminderBanner?: boolean;
  onDismissEmailReminderBanner?: () => void;
  onOpenEmailVerification?: () => void;
}

export const WalletView: React.FC<WalletViewProps> = ({
  userId,
  userEmail,
  isVip,
  currentPlanId,
  billingCycle = 'annual',
  ambassadorFreeMonths = 0,
  ambassadorCapacityBonus = 0,
  onUpgradeSuccess,
  onSelectPlanUpgrade,
  onNavigateToAmbassador,
  emailVerified = true,
  showEmailReminderBanner = false,
  onDismissEmailReminderBanner,
  onOpenEmailVerification,
}) => {
  const effectivePlanId: SubscriptionPlanId =
    currentPlanId ?? (isVip ? 'premium' : 'free');
  const activePlan = SUBSCRIPTION_PLANS[effectivePlanId];
  const [invoices, setInvoices] = useState<WalletTransactionData[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  const currentUid =
    userId ||
    auth.currentUser?.uid ||
    canonicalCustomerEmailUid(userEmail) ||
    `guest_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

  useEffect(() => {
    let active = true;
    setIsLoadingInvoices(true);
    fetchUserWalletTransactions(currentUid)
      .then((txs) => {
        if (!active) return;
        const billingOnly = (txs || []).filter(
          (tx) => tx.type !== 'TOPUP' && tx.type !== 'REFERRAL_REWARD'
        );
        setInvoices(billingOnly);
      })
      .catch(() => {
        if (active) setInvoices([]);
      })
      .finally(() => {
        if (active) setIsLoadingInvoices(false);
      });
    return () => {
      active = false;
    };
  }, [currentUid, effectivePlanId]);

  const handleCopyInvoiceId = async (txRef: string) => {
    if (!txRef) return;
    try {
      await navigator.clipboard.writeText(txRef);
      setCopiedTxId(txRef);
      setTimeout(() => {
        setCopiedTxId((curr) => (curr === txRef ? null : curr));
      }, 2200);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  const handlePlanSelection = (
    planId: SubscriptionPlanId,
    cycle: BillingCycle
  ) => {
    if (planId === 'free') return;
    if (onSelectPlanUpgrade) {
      onSelectPlanUpgrade(planId, cycle);
    } else {
      onUpgradeSuccess();
    }
  };

  const renewalDateLabel = useMemo(() => {
    if (effectivePlanId === 'free') {
      return ambassadorFreeMonths > 0
        ? `مؤهل لـ ${ambassadorFreeMonths} شهر Basic مجاني`
        : 'مجانية دائماً · بلا تاريخ انتهاء';
    }
    const baseDate = new Date();
    const monthsToAdd =
      (billingCycle === 'annual' ? 12 : 1) + Math.max(0, ambassadorFreeMonths);
    baseDate.setMonth(baseDate.getMonth() + monthsToAdd);
    return baseDate.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [effectivePlanId, billingCycle, ambassadorFreeMonths]);

  const activeCyclePriceLabel = useMemo(() => {
    if (effectivePlanId === 'free') return '$0 · مجانية للأبد';
    const price = getPlanPriceUsd(effectivePlanId, billingCycle);
    return billingCycle === 'annual'
      ? `${formatPlanPriceUsd(price)} / سنوياً (توفير ${ANNUAL_BILLING_SAVINGS_PERCENT}%)`
      : `${formatPlanPriceUsd(price)} / شهرياً`;
  }, [effectivePlanId, billingCycle]);

  const effectiveTreeLimitLabel = useMemo(() => {
    if (effectivePlanId === 'free') {
      const total = activePlan.limits.maxTreeNodes + ambassadorCapacityBonus;
      return ambassadorCapacityBonus > 0
        ? `${total.toLocaleString('en-US')} فرداً (${activePlan.limits.maxTreeNodes} أساسي + ${ambassadorCapacityBonus} هدية سفير)`
        : `${activePlan.limits.maxTreeNodes.toLocaleString('en-US')} فرد`;
    }
    return `سعة موسّعة (${activePlan.limits.maxTreeNodes.toLocaleString('en-US')} فرد)`;
  }, [effectivePlanId, activePlan.limits.maxTreeNodes, ambassadorCapacityBonus]);

  const effectiveVaultLimitLabel = useMemo(() => {
    if (activePlan.limits.maxVaultItems === null) {
      return 'سعة مفتوحة غير محدودة';
    }
    if (effectivePlanId === 'free') {
      const total = activePlan.limits.maxVaultItems + ambassadorCapacityBonus;
      return ambassadorCapacityBonus > 0
        ? `${total.toLocaleString('en-US')} مقتنى (${activePlan.limits.maxVaultItems} أساسي + ${ambassadorCapacityBonus} هدية سفير)`
        : `${activePlan.limits.maxVaultItems.toLocaleString('en-US')} مقتنى`;
    }
    return `${activePlan.limits.maxVaultItems.toLocaleString('en-US')} مقتنى`;
  }, [effectivePlanId, activePlan.limits.maxVaultItems, ambassadorCapacityBonus]);

  const getInvoiceBadgeLabel = (tx: WalletTransactionData): string => {
    switch (tx.type) {
      case 'UPGRADE_ANNUAL_VIP':
        return 'اشتراك باقة Premium';
      case 'PURCHASE_ROOT_5USD':
        return 'اشتراك باقة Basic';
      case 'UPGRADE_REGISTRAR':
        return 'توثيق أمين السجل';
      case 'UNLOCK_CAPSULE':
        return 'ترقية خدمة إضافية';
      default:
        return 'فاتورة اشتراك';
    }
  };

  return (
    <div className="space-y-6 text-[#1F1F1C]">
      {/* Calm Dismissible Email Verification Reminder */}
      {showEmailReminderBanner && !emailVerified && (
        <div className="rounded-xl bg-[#FAF7F2] border border-[#D97757]/45 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#1F1F1C]">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#D97757] shrink-0" />
            <span>
              تذكير هادئ: بريدك الإلكتروني (<strong className="font-mono">{userEmail}</strong>) غير موثّق بعد — وثّقه لاستلام إيصالات الفواتير وتفعيل النشر العام.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onOpenEmailVerification && (
              <button
                type="button"
                onClick={onOpenEmailVerification}
                className="px-3 py-1 rounded-lg bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-[11px] font-display font-bold transition-colors cursor-pointer"
              >
                توثيق البريد الآن
              </button>
            )}
            {onDismissEmailReminderBanner && (
              <button
                type="button"
                onClick={onDismissEmailReminderBanner}
                aria-label="إغلاق التذكير"
                className="p-1 rounded-lg hover:bg-[#E8DED2] text-[#1F1F1C]/65 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 1. LUXURY ACTIVE SUBSCRIPTION & AMBASSADOR REWARDS HERO CARD */}
      <section className="rounded-3xl bg-[#FAF7F2] border border-[#D8C7B2] overflow-hidden shadow-[0_14px_34px_-22px_rgba(31,31,28,0.16)]">
        <div className="h-1.5 w-full bg-[#D97757]" aria-hidden="true" />
        <div className="p-6 sm:p-7 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="space-y-2.5 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8DED2] border border-[#D8C7B2] text-xs font-display font-bold text-[#1F1F1C]">
                  <Crown className="w-3.5 h-3.5 text-[#D97757]" />
                  <span>باقتك الحالية في منصة جذوري</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F5F1E8] border border-[#D97757]/40 text-[11px] font-display font-bold text-[#D97757]">
                  {activePlan.code} · {activeCyclePriceLabel}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#1F1F1C]">
                {activePlan.nameAr}{' '}
                <span className="text-[#D97757]">({activePlan.code})</span>
              </h2>
              <p className="text-xs sm:text-sm text-[#1F1F1C]/75 leading-relaxed">
                {activePlan.taglineAr}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {effectivePlanId === 'premium' ? (
                <span className="px-4 py-2.5 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-bold inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#D97757]" />
                  <span>جميع مزايا Premium مفعّلة بالكامل</span>
                </span>
              ) : (
                <>
                  {effectivePlanId === 'free' && (
                    <button
                      type="button"
                      onClick={() => handlePlanSelection('basic', 'annual')}
                      className="px-4 py-2.5 rounded-xl bg-[#E8DED2] hover:bg-[#D8C7B2]/80 border border-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <CreditCard className="w-4 h-4 text-[#D97757]" />
                      <span>الترقية إلى Basic</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handlePlanSelection('premium', 'annual')}
                    className="px-5 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs sm:text-sm font-display font-bold inline-flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      الترقية إلى Premium (وفّر {ANNUAL_BILLING_SAVINGS_PERCENT}% سنوياً)
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Subscription Meta Grid: Billing Cycle, Renewal Date, Active Capacities */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-4 border-t border-[#D8C7B2]/80">
            <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-4 space-y-1">
              <div className="text-[11px] font-semibold text-[#1F1F1C]/65 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-[#D97757]" />
                <span>دورة الفوترة</span>
              </div>
              <div className="text-sm font-display font-extrabold text-[#1F1F1C]">
                {effectivePlanId === 'free'
                  ? 'اشتراك مجاني دائم'
                  : billingCycle === 'annual'
                  ? `سنوي (توفير ${ANNUAL_BILLING_SAVINGS_PERCENT}%)`
                  : 'شهري مرن'}
              </div>
            </div>

            <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-4 space-y-1">
              <div className="text-[11px] font-semibold text-[#1F1F1C]/65 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#D97757]" />
                <span>تاريخ التجديد القادم</span>
              </div>
              <div className="text-sm font-display font-extrabold text-[#1F1F1C]">
                {renewalDateLabel}
              </div>
            </div>

            <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-4 space-y-1">
              <div className="text-[11px] font-semibold text-[#1F1F1C]/65 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#D97757]" />
                <span>سعة «شجرتي» المتاحة</span>
              </div>
              <div className="text-xs sm:text-sm font-display font-extrabold text-[#1F1F1C] tabular-nums">
                {effectiveTreeLimitLabel}
              </div>
            </div>

            <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-4 space-y-1">
              <div className="text-[11px] font-semibold text-[#1F1F1C]/65 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#D97757]" />
                <span>سعة «خزانتي» المتاحة</span>
              </div>
              <div className="text-xs sm:text-sm font-display font-extrabold text-[#1F1F1C] tabular-nums">
                {effectiveVaultLimitLabel}
              </div>
            </div>
          </div>

          {/* Ambassador Time & Capacity Rewards Earned Strip */}
          <div className="rounded-2xl bg-[#E8DED2]/70 border border-[#D8C7B2] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="text-xs sm:text-sm font-display font-extrabold text-[#1F1F1C]">
                  رصيد مكافآت برنامج «سفير جذوري» المكتسبة
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#1F1F1C]/80">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]" />
                    أشهر اشتراك مجانية مضافة:{' '}
                    <strong className="font-display font-extrabold text-[#D97757] tabular-nums">
                      +{ambassadorFreeMonths} شهر
                    </strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]" />
                    مقاعد سعة إضافية مكتسبة:{' '}
                    <strong className="font-display font-extrabold text-[#1F1F1C] tabular-nums">
                      +{ambassadorCapacityBonus} مقعد
                    </strong>{' '}
                    <span className="text-[11px] text-[#1F1F1C]/60">
                      (من سقف +{AMBASSADOR_REWARDS_CONFIG.maxFreeCapacityBonus} للباقة المجانية)
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {onNavigateToAmbassador && (
              <button
                type="button"
                onClick={onNavigateToAmbassador}
                className="px-4 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#D97757] text-[#1F1F1C] hover:text-[#F5F1E8] border border-[#D8C7B2] hover:border-[#D97757] text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Award className="w-3.5 h-3.5" />
                <span>اكسب أشهراً وسعة مجانية</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 2. 3-TIER SUBSCRIPTION SWITCHER & OFFICIAL COMPARISON MATRIX */}
      <section className="rounded-3xl bg-[#F5F1E8] border border-[#D8C7B2] p-5 sm:p-7">
        <SubscriptionPricingSection
          mode="dashboard"
          currentPlanId={effectivePlanId}
          initialCycle={billingCycle}
          onSelectPlan={handlePlanSelection}
          showComparisonTable={true}
          compact={true}
        />
      </section>

      {/* 3. SUBSCRIPTIONS & BILLING INVOICES HISTORY */}
      <section className="rounded-2xl bg-[#FAF7F2] border border-[#D8C7B2] p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-display font-bold text-[#1F1F1C]">
                سجل الاشتراكات والفواتير السابقة
              </h3>
              <p className="text-[11px] text-[#1F1F1C]/65 mt-0.5">
                جميع فواتير الترقية والتجديد موثقة برقم مرجعي فريد قابل للنسخ والمراجعة مع خدمة العملاء
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] text-[11px] font-semibold text-[#1F1F1C]/80">
            سجل فواتير موثّق
          </span>
        </div>

        {isLoadingInvoices ? (
          <p className="text-xs text-[#1F1F1C]/60 text-center py-6">
            جاري تحميل سجل الاشتراكات والفواتير...
          </p>
        ) : invoices.length === 0 ? (
          <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/80 px-4 py-7 text-center space-y-1.5">
            <p className="text-xs sm:text-sm font-display font-bold text-[#1F1F1C]">
              لا توجد فواتير مدفوعة مسجلة حتى الآن
            </p>
            <p className="text-[11.5px] text-[#1F1F1C]/65">
              عند ترقية باقتك إلى Basic أو Premium ستظهر جميع فواتيرك وإيصالاتك الموثّقة هنا تلقائياً.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#D8C7B2]/60">
            {invoices.map((tx) => {
              const txRef = tx.transactionId || tx.id;
              const statusLabel =
                tx.status === 'FAILED'
                  ? 'غير مكتملة'
                  : tx.status === 'PENDING'
                  ? 'قيد المعالجة'
                  : 'مدفوعة ✓';
              const isCopied = copiedTxId === txRef;

              return (
                <div
                  key={tx.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0 mt-0.5">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[#1F1F1C]">
                          {tx.descriptionAr || tx.reason}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#F5F1E8] border border-[#D8C7B2] text-[10px] font-semibold text-[#D97757]">
                          {getInvoiceBadgeLabel(tx)}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#E8DED2] text-[10px] font-bold text-[#1F1F1C]">
                          {statusLabel}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#1F1F1C]/65">
                        <span
                          dir="ltr"
                          className="font-mono font-bold text-[#1F1F1C] bg-[#F5F1E8] px-2 py-0.5 rounded border border-[#D8C7B2]"
                        >
                          {txRef}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyInvoiceId(txRef)}
                          title="نسخ رقم الفاتورة"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#E8DED2] hover:bg-[#D97757] hover:text-[#F5F1E8] text-[#1F1F1C] text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>نسخ المرجع</span>
                            </>
                          )}
                        </button>
                        <span>·</span>
                        <span>
                          {new Date(tx.createdAt).toLocaleDateString('ar-SA')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    dir="ltr"
                    className="font-mono font-bold text-sm text-[#1F1F1C] tabular-nums self-end sm:self-center shrink-0"
                  >
                    ${tx.amount.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
