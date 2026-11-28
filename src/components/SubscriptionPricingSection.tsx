import React, { useState } from 'react';
import {
  Check,
  Clock,
  Crown,
  Lock,
  Sparkles,
  Trees,
  ArrowLeft,
} from 'lucide-react';
import {
  ANNUAL_BILLING_SAVINGS_PERCENT,
  BillingCycle,
  SUBSCRIPTION_COMPARISON_ROWS,
  SUBSCRIPTION_FOOTNOTES,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_PLAN_ORDER,
  SubscriptionComparisonCell,
  SubscriptionPlanId,
  formatPlanPriceUsd,
  getPlanPriceUsd,
  getPlanRank,
} from '../config/subscriptionPlans';

interface SubscriptionPricingSectionProps {
  mode?: 'landing' | 'dashboard';
  currentPlanId?: SubscriptionPlanId;
  initialCycle?: BillingCycle;
  onSelectPlan: (planId: SubscriptionPlanId, cycle: BillingCycle) => void;
  showComparisonTable?: boolean;
  compact?: boolean;
}

export const SubscriptionPricingSection: React.FC<
  SubscriptionPricingSectionProps
> = ({
  mode = 'landing',
  currentPlanId,
  initialCycle = 'annual',
  onSelectPlan,
  showComparisonTable = true,
  compact = false,
}) => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialCycle);

  const renderComparisonCell = (cell: SubscriptionComparisonCell) => {
    if (cell.status === 'included') {
      return (
        <div className="inline-flex flex-col items-center text-center gap-0.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-display font-bold text-[#1F1F1C]">
            <Check className="w-4 h-4 text-[#D97757] shrink-0" aria-hidden="true" />
            <span>{cell.labelAr}</span>
          </span>
          {cell.sublabelAr && (
            <span className="text-[11px] text-[#1F1F1C]/65 leading-snug">
              {cell.sublabelAr}
            </span>
          )}
        </div>
      );
    }

    if (cell.status === 'limited') {
      return (
        <div className="inline-flex flex-col items-center text-center gap-0.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-display font-bold text-[#1F1F1C]">
            <Check className="w-4 h-4 text-[#D97757] shrink-0" aria-hidden="true" />
            <span>{cell.labelAr}</span>
          </span>
          {cell.sublabelAr && (
            <span className="text-[11px] text-[#1F1F1C]/65 leading-snug">
              {cell.sublabelAr}
            </span>
          )}
        </div>
      );
    }

    if (cell.status === 'upcoming') {
      return (
        <div className="inline-flex flex-col items-center text-center gap-0.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-display font-bold text-[#D97757]">
            <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{cell.labelAr}</span>
          </span>
          {cell.sublabelAr && (
            <span className="text-[11px] text-[#1F1F1C]/65 leading-snug">
              {cell.sublabelAr}
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="inline-flex flex-col items-center text-center gap-0.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1F1F1C]/50">
          <Lock className="w-3.5 h-3.5 text-[#1F1F1C]/40 shrink-0" aria-hidden="true" />
          <span>{cell.labelAr}</span>
        </span>
        {cell.sublabelAr && (
          <span className="text-[11px] text-[#1F1F1C]/50 leading-snug">
            {cell.sublabelAr}
          </span>
        )}
      </div>
    );
  };

  return (
    <div dir="rtl" className="w-full text-[#1F1F1C] space-y-8">
      {/* Header + Billing Cycle Segmented Control */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-display font-bold text-[#D97757]">
            {mode === 'landing'
              ? 'الباقات والاشتراكات · ابدأ مجاناً وترقَّ متى شئت'
              : 'باقات جذوري الثلاث · اختر الخطة المناسبة لعائلتك'}
          </p>
          <h2
            className={`${
              compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl lg:text-4xl'
            } font-display font-extrabold text-[#1F1F1C] leading-tight text-balance`}
          >
            {mode === 'landing'
              ? 'ابدأ بناء شجرة عائلتك وخزانتك مجاناً، واكتشف جذورك حين تكون مستعداً'
              : 'ترقية سلسة من الباقة المجانية إلى Basic أو Premium'}
          </h2>
          <p className="text-xs sm:text-sm text-[#1F1F1C]/75 leading-relaxed">
            ثلاث باقات واضحة بدون أي تكاليف خفية: باقة مجانية دائمة للتأسيس والحفظ، وباقتان مدفوعتان لربط الجذور والاكتشاف وبوابة العائلة.
          </p>
        </div>

        {/* Monthly / Annual Billing Switch */}
        <div
          role="group"
          aria-label="دورة الفوترة"
          className="inline-flex items-center self-start md:self-auto p-1 rounded-2xl bg-[#E8DED2] border border-[#D8C7B2] shrink-0"
        >
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-display font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              billingCycle === 'monthly'
                ? 'bg-[#FDFBF7] text-[#1F1F1C] shadow-xs border border-[#D8C7B2]'
                : 'text-[#1F1F1C]/70 hover:text-[#1F1F1C]'
            }`}
          >
            شهري
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('annual')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-display font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
              billingCycle === 'annual'
                ? 'bg-[#D97757] text-[#F5F1E8] shadow-xs'
                : 'text-[#1F1F1C]/75 hover:text-[#1F1F1C]'
            }`}
          >
            <span>سنوي</span>
            <span
              className={`text-[11px] font-display font-bold ${
                billingCycle === 'annual'
                  ? 'text-[#F5F1E8]/95'
                  : 'text-[#D97757]'
              }`}
            >
              · وفّر {ANNUAL_BILLING_SAVINGS_PERCENT}%
            </span>
          </button>
        </div>
      </div>

      {/* 3 Luxury Warm Ivory Tier Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch">
        {SUBSCRIPTION_PLAN_ORDER.map((planId) => {
          const plan = SUBSCRIPTION_PLANS[planId];
          const price = getPlanPriceUsd(planId, billingCycle);
          const isPremium = planId === 'premium';
          const isBasic = planId === 'basic';
          const isCurrent = mode === 'dashboard' && currentPlanId === planId;
          const isLowerThanCurrent =
            mode === 'dashboard' &&
            Boolean(currentPlanId) &&
            getPlanRank(planId) < getPlanRank(currentPlanId!);

          const PlanIcon = isPremium ? Crown : isBasic ? Sparkles : Trees;

          return (
            <article
              key={plan.id}
              className={`rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-transform duration-150 ${
                isPremium
                  ? 'bg-[#FDFBF7] border-2 border-[#D97757] shadow-[0_18px_40px_-24px_rgba(217,119,87,0.45)]'
                  : isBasic
                    ? 'bg-[#FAF7F2] border border-[#D8C7B2]'
                    : 'bg-[#F5F1E8] border border-[#D8C7B2]'
              }`}
            >
              <div className="space-y-5">
                {/* Top Kicker & Icon */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-display font-bold text-[#D97757]">
                      <span>{plan.code}</span>
                      <span aria-hidden="true" className="text-[#D8C7B2]">
                        ·
                      </span>
                      <span>{plan.badgeAr}</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-display font-extrabold text-[#1F1F1C]">
                      {plan.nameAr}
                    </h3>
                  </div>

                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                      isPremium
                        ? 'bg-[#D97757] text-[#F5F1E8] border-[#D97757]'
                        : 'bg-[#E8DED2] text-[#D97757] border-[#D8C7B2]'
                    }`}
                  >
                    <PlanIcon className="w-5 h-5" aria-hidden="true" />
                  </div>
                </div>

                {/* Price Block */}
                <div className="pb-5 border-b border-[#D8C7B2]/80 space-y-1.5">
                  <div className="flex items-baseline gap-2">
                    <span
                      dir="ltr"
                      className="text-3xl sm:text-4xl font-display font-extrabold text-[#1F1F1C] tabular-nums tracking-tight"
                    >
                      {formatPlanPriceUsd(price)}
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-[#1F1F1C]/65">
                      {planId === 'free'
                        ? '/ مجانية دائماً'
                        : billingCycle === 'annual'
                          ? '/ سنوياً'
                          : '/ شهرياً'}
                    </span>
                  </div>

                  {planId === 'free' ? (
                    <p className="text-xs text-[#1F1F1C]/65">
                      بدون بطاقة بنكية · شجرتي ({plan.limits.maxTreeNodes} فرد) + خزانتي ({plan.limits.maxVaultItems} مقتنىً)
                    </p>
                  ) : billingCycle === 'annual' ? (
                    <p className="text-xs font-medium text-[#D97757] tabular-nums">
                      ما يعادل ~${plan.annualMonthlyEquivalentUsd.toFixed(2)} شهرياً · توفير{' '}
                      {plan.annualSavingsPercent}% مقارنة بالاشتراك الشهري
                    </p>
                  ) : (
                    <p className="text-xs text-[#1F1F1C]/65 tabular-nums">
                      أو ${plan.annualPriceUsd.toFixed(2)} سنوياً (توفير{' '}
                      {plan.annualSavingsPercent}%)
                    </p>
                  )}
                </div>

                {/* Tagline */}
                <p className="text-xs sm:text-sm text-[#1F1F1C]/85 leading-relaxed font-medium">
                  {plan.taglineAr}
                </p>

                {/* Feature Highlights */}
                <ul className="space-y-2.5 pt-1">
                  {plan.highlightsAr.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-xs sm:text-[13px] text-[#1F1F1C]/85 leading-relaxed"
                    >
                      <Check
                        className="w-4 h-4 text-[#D97757] shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action CTA */}
              <div className="pt-6 mt-6 border-t border-[#D8C7B2]/60">
                {isCurrent ? (
                  <div className="w-full py-3 px-4 rounded-2xl bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] text-xs sm:text-sm font-display font-bold flex items-center justify-center gap-2">
                    <Check className="w-4 h-4 text-[#D97757]" aria-hidden="true" />
                    <span>باقتك النشطة حالياً</span>
                  </div>
                ) : isLowerThanCurrent ? (
                  <div className="w-full py-3 px-4 rounded-2xl bg-[#E8DED2]/60 border border-[#D8C7B2] text-[#1F1F1C]/60 text-xs sm:text-sm font-display font-bold text-center">
                    مشمولة ضمن باقتك الحالية
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectPlan(plan.id, billingCycle)}
                    className={`w-full min-h-[44px] py-3 px-5 rounded-2xl text-xs sm:text-sm font-display font-extrabold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                      isPremium
                        ? 'bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] shadow-xs'
                        : isBasic
                          ? 'bg-[#E8DED2] hover:bg-[#D97757] text-[#1F1F1C] hover:text-[#F5F1E8] border border-[#D8C7B2]'
                          : 'bg-[#FAF7F2] hover:bg-[#E8DED2] text-[#1F1F1C] border border-[#D97757]/60'
                    }`}
                  >
                    <span>
                      {mode === 'dashboard'
                        ? `الترقية إلى ${plan.code} (${formatPlanPriceUsd(price)}${
                            billingCycle === 'annual' ? '/سنة' : '/شهر'
                          })`
                        : plan.id === 'free'
                          ? plan.ctaLabelAr
                          : `اختر ${plan.code} (${formatPlanPriceUsd(price)}${
                              billingCycle === 'annual' ? '/سنة' : '/شهر'
                            })`}
                    </span>
                    <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Detailed 7-Row Comparison Matrix + Approved Footnotes */}
      {showComparisonTable && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-[#FAF7F2] border border-[#D8C7B2] overflow-hidden">
            <div className="px-5 sm:px-7 py-4 bg-[#E8DED2]/80 border-b border-[#D8C7B2] flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base sm:text-lg font-display font-extrabold text-[#1F1F1C]">
                  مقارنة تفصيلية بين الباقات الثلاث
                </h3>
                <p className="text-xs text-[#1F1F1C]/70 mt-0.5">
                  شفافية تامة في الصلاحيات والسعات والخدمات المتاحة لكل باقة
                </p>
              </div>
              <span className="text-xs font-display font-bold text-[#D97757] tabular-nums">
                {billingCycle === 'annual'
                  ? 'الأسعار المعروضة للفوترة السنوية (توفير 17%)'
                  : 'الأسعار المعروضة للفوترة الشهرية'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-right border-collapse">
                <thead>
                  <tr className="border-b border-[#D8C7B2] bg-[#F5F1E8]/80 text-xs font-display font-extrabold text-[#1F1F1C]">
                    <th scope="col" className="py-4 px-5 sm:px-6 text-right w-[34%]">
                      الميزة / الخدمة
                    </th>
                    <th scope="col" className="py-4 px-4 text-center w-[22%]">
                      <div className="font-extrabold">Free</div>
                      <div className="text-[11px] font-medium text-[#1F1F1C]/65 tabular-nums">
                        $0 دائماً
                      </div>
                    </th>
                    <th scope="col" className="py-4 px-4 text-center w-[22%]">
                      <div className="font-extrabold">Basic</div>
                      <div className="text-[11px] font-medium text-[#1F1F1C]/65 tabular-nums">
                        {formatPlanPriceUsd(getPlanPriceUsd('basic', billingCycle))}{' '}
                        {billingCycle === 'annual' ? '/ سنة' : '/ شهر'}
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="py-4 px-4 text-center w-[22%] bg-[#E8DED2]/45"
                    >
                      <div className="font-extrabold text-[#D97757]">Premium</div>
                      <div className="text-[11px] font-medium text-[#1F1F1C]/75 tabular-nums">
                        {formatPlanPriceUsd(getPlanPriceUsd('premium', billingCycle))}{' '}
                        {billingCycle === 'annual' ? '/ سنة' : '/ شهر'}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8C7B2]/65">
                  {SUBSCRIPTION_COMPARISON_ROWS.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-[#F5F1E8]/60 transition-colors"
                    >
                      <td className="py-4 px-5 sm:px-6 align-middle">
                        <div className="text-xs sm:text-sm font-display font-bold text-[#1F1F1C]">
                          {row.featureAr}
                        </div>
                        {row.featureSubtitleAr && (
                          <div className="text-[11px] text-[#1F1F1C]/65 mt-0.5 leading-snug">
                            {row.featureSubtitleAr}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center align-middle">
                        {renderComparisonCell(row.free)}
                      </td>
                      <td className="py-4 px-4 text-center align-middle">
                        {renderComparisonCell(row.basic)}
                      </td>
                      <td className="py-4 px-4 text-center align-middle bg-[#E8DED2]/25">
                        {renderComparisonCell(row.premium)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3 Official Approved Explanatory Footnotes */}
          <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] px-5 py-4 space-y-2.5">
            {SUBSCRIPTION_FOOTNOTES.map((note) => (
              <p
                key={note.id}
                className="text-[11.5px] sm:text-xs text-[#1F1F1C]/75 leading-relaxed flex items-start gap-2"
              >
                <span className="font-display font-extrabold text-[#D97757] shrink-0">
                  {note.marker}
                </span>
                <span>{note.textAr}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
