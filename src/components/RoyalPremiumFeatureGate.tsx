import React from 'react';
import { Crown, Sparkles, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { JUTHORI_SERVICE_ICONS } from '../config/serviceIcons';

interface RoyalPremiumFeatureGateProps {
  feature: 'my_tree' | 'my_site';
  familyName?: string;
  onUpgradePremium: () => void;
  onExploreCommunity?: () => void;
}

export const RoyalPremiumFeatureGate: React.FC<RoyalPremiumFeatureGateProps> = ({
  feature,
  familyName,
  onUpgradePremium,
  onExploreCommunity,
}) => {
  const isTree = feature === 'my_tree';
  const cleanFamily = (familyName || 'عائلتك').trim();

  const heading = isTree
    ? `بناء شجرة عائلة ${cleanFamily} التفاعلية — ميزة حصرية لعضوية جذوري بريميوم`
    : `إنشاء ونشر موقع ديوان عائلة ${cleanFamily} — ميزة حصرية لعضوية جذوري بريميوم`;

  const subtitle = isTree
    ? 'تتيح عضوية جذوري بريميوم إنشاء دوحتك العائلية الخاصة من الصفر، وإضافة الأجيال والفروع والصور والسير الذاتية، وتصدير المخطوطات بدقة طباعية عالية.'
    : 'تتيح عضوية جذوري بريميوم تصميم ونشر بوابة إلكترونية مستقلة لعائلتك على رابط نظيف مع خزانة ذاكرة ومجالس خاصة وضوابط خصوصية متقدمة.';

  const highlights = isTree
    ? [
        'دوحة عائلية تفاعلية خاصة تبدأ ببطاقتك الشخصية وتتسع لكافة الأجيال',
        'إضافة الصور، السير الذاتية، التوثيقات، والربط الأسري السهل',
        'دعوة أفراد العائلة لإثراء الشجرة مع مراجعة واعتماد كامل منك',
        'تصدير مخطوطات شجرية فاخرة عالية الدقة جاهزة للطباعة والمجالس',
      ]
    : [
        'رابط عائلي نظيف ومستقل يحمل اسم عائلتك مع قوالب تراثية فاخرة',
        'حماية متكاملة لدائرة العائلة برمز دخول سري أو قائمة دعوات معتمدة',
        'عرض تفاعلي للدوحة العائلية، خزانة الصور، المناسبات، وكلمة عميد الأسرة',
        'استقبال مقترحات الإثراء من أفراد عائلتك ومراجعتها قبل النشر',
      ];

  return (
    <div
      dir="rtl"
      className="relative overflow-hidden rounded-3xl border border-[#D8C7B2] bg-[#FAF7F2] p-6 sm:p-10 text-[#1F1F1C] shadow-[0_24px_60px_-24px_rgba(31,31,28,0.12)]"
      data-testid={`royal-premium-gate-${feature}`}
    >
      {/* Subtle geometric parchment sheen */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            'radial-gradient(circle at 85% 15%, rgba(217,119,87,0.16), transparent 45%), radial-gradient(circle at 12% 88%, rgba(216,199,178,0.28), transparent 42%)',
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-xl border border-[#D8C7B2] bg-[#E8DED2] px-4 py-1.5 text-xs font-bold text-[#D97757]">
          <Crown className="w-4 h-4 text-[#D97757]" />
          <span>ميزة حصرية لعضوية جذوري بريميوم</span>
        </div>

        <div className="mx-auto w-16 h-16 rounded-2xl border border-[#D8C7B2] bg-[#E8DED2] flex items-center justify-center shadow-xs">
          {isTree ? (
            <JUTHORI_SERVICE_ICONS.tree className="w-8 h-8 text-[#D97757]" />
          ) : (
            <JUTHORI_SERVICE_ICONS.site className="w-8 h-8 text-[#D97757]" />
          )}
        </div>

        <div className="space-y-3">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold leading-snug text-[#1F1F1C]">
            {heading}
          </h2>
          <p className="text-sm sm:text-base leading-relaxed text-[#1F1F1C]/75 max-w-2xl mx-auto">
            {subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right pt-2">
          {highlights.map((item) => (
            <div
              key={item}
              className="flex items-start gap-2.5 rounded-2xl border border-[#D8C7B2] bg-[#F5F1E8] px-4 py-3"
            >
              <CheckCircle2 className="w-4 h-4 text-[#D97757] shrink-0 mt-0.5" />
              <span className="text-xs sm:text-sm text-[#1F1F1C] leading-relaxed">
                {item}
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-[#D8C7B2] bg-[#E8DED2]/65 px-4 py-3 text-xs text-[#1F1F1C]/80 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#D97757] shrink-0" />
          <span>
            حسابك الحالي معزول وآمن بالكامل — يمكنك تصفح شجرة عائلتك المنضمّ إليها وإثرائها مجاناً من تبويب «مجتمعي»، أو الترقية لإنشاء دوحتك وموقعك المستقل.
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onUpgradePremium}
            data-testid={`royal-premium-upgrade-btn-${feature}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D97757] hover:bg-[#C46546] px-6 py-3.5 text-sm font-extrabold text-[#F5F1E8] shadow-sm transition cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            <span>ترقية حسابي إلى بريميوم</span>
          </button>

          {onExploreCommunity && (
            <button
              type="button"
              onClick={onExploreCommunity}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D8C7B2] bg-[#F5F1E8] hover:bg-[#E8DED2] px-5 py-3.5 text-sm font-bold text-[#1F1F1C] transition cursor-pointer whitespace-nowrap"
            >
              <JUTHORI_SERVICE_ICONS.community className="w-4 h-4 text-[#D97757]" />
              <span>استعراض دوائر العائلات المنضمّ إليها</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
