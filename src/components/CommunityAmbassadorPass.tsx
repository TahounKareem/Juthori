import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Award,
  CalendarPlus,
  Check,
  Copy,
  Gift,
  Layers,
  Send,
  Share2,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  ACTIVE_PUBLIC_SITE_DISPLAY_HOST,
  resolveClientPublicAppBaseUrl,
} from '../config/referralAndSiteConfig';
import {
  AMBASSADOR_REWARDS_CONFIG,
  computeAmbassadorRewards,
} from '../config/subscriptionPlans';
import { ReferralDashboardStats } from '../services/priority4Service';

interface CommunityAmbassadorPassProps {
  familyName: string;
  referralStats: ReferralDashboardStats;
  onLogActivity?: (title: string, details: string) => void;
}

export const CommunityAmbassadorPass: React.FC<CommunityAmbassadorPassProps> = ({
  familyName,
  referralStats,
  onLogActivity,
}) => {
  const [miniQrDataUrl, setMiniQrDataUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const cleanCode = (referralStats.referralCode || 'JTH-GUEST').trim().toUpperCase();
  const cleanOfficialReferralUrl = `${resolveClientPublicAppBaseUrl()}/?ref=${encodeURIComponent(cleanCode)}`;

  const rewards = computeAmbassadorRewards(
    referralStats.registeredCount,
    referralStats.rewardedAnnualCount
  );

  const craftedArabicShareText = `أدعوك لتوثيق شجرة عائلتك وحفظ صور ووثائق أسرتك عبر منصة «جذوري» لحفظ الإرث العائلي العربي ✦\nسجّل مجاناً عبر رابط الدعوة الخاص بي من عائلة ${familyName}:\n${cleanOfficialReferralUrl}`;

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(craftedArabicShareText)}`;
  const telegramHref = `https://t.me/share/url?url=${encodeURIComponent(
    cleanOfficialReferralUrl
  )}&text=${encodeURIComponent(
    `أدعوك لتوثيق شجرة عائلتك واكتشاف جذورك عبر منصة «جذوري» ✦ (دعوة من عائلة ${familyName})`
  )}`;

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(cleanOfficialReferralUrl, {
      width: 220,
      margin: 1,
      color: {
        dark: '#1F1F1C',
        light: '#F5F1E8',
      },
    })
      .then((url) => {
        if (mounted) setMiniQrDataUrl(url);
      })
      .catch(() => {
        if (mounted) setMiniQrDataUrl('');
      });
    return () => {
      mounted = false;
    };
  }, [cleanOfficialReferralUrl]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(cleanOfficialReferralUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2400);
      onLogActivity?.(
        'نسخ رابط سفير جذوري الرسمي',
        `تم نسخ رابط الدعوة الرسمي ${cleanOfficialReferralUrl}`
      );
    } catch {
      // Ignore clipboard restriction
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(cleanCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Ignore clipboard restriction
    }
  };

  return (
    <div className="space-y-6">
      {/* Warm Ivory & Terracotta Ambassador Pass (Time & Capacity Rewards) */}
      <div className="relative overflow-hidden rounded-2xl bg-[#FAF7F2] border border-[#D8C7B2] text-[#1F1F1C] shadow-sm">
        <div className="h-1.5 w-full bg-[#D97757]" aria-hidden="true" />

        <div className="p-6 sm:p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          {/* Pass Identity & Copy */}
          <div className="space-y-4 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span className="inline-flex items-center gap-1.5 font-display font-bold text-[#D97757] tracking-wide">
                <Award className="w-4 h-4 text-[#D97757]" aria-hidden="true" />
                بطاقة سفير جذوري المعتمد
              </span>
              <span className="text-[#D8C7B2]">·</span>
              <span className="text-[#1F1F1C]/80 font-semibold">
                مكافآت مزدوجة: +{AMBASSADOR_REWARDS_CONFIG.capacityBonusPerFreeInvite} مقعد سعة · +{AMBASSADOR_REWARDS_CONFIG.freeMonthsPerPaidSubscriber} شهر اشتراك مجاني
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-display font-extrabold text-[#1F1F1C] leading-snug">
                شارك إرث «جذوري» واكسب أشهراً مجانية وسعة إضافية لشجرتك وخزانتك
              </h3>
              <p className="text-xs sm:text-sm text-[#1F1F1C]/75 leading-relaxed max-w-2xl">
                عن كل قريب أو صديق ينشئ حسابه المجاني عبر رابطك تحصل على{' '}
                <strong className="text-[#1F1F1C]">
                  +{AMBASSADOR_REWARDS_CONFIG.capacityBonusPerFreeInvite} مقعد سعة في شجرتي وخزانتي
                </strong>{' '}
                (حتى سقف +{AMBASSADOR_REWARDS_CONFIG.maxFreeCapacityBonus} مقعد إضافي)، وعند تفعيل أي مدعو لاشتراك{' '}
                <strong className="text-[#D97757]">Basic أو Premium</strong> يُضاف إلى حسابك{' '}
                <strong className="text-[#1F1F1C]">شهر اشتراك مجاني كامل</strong> تلقائياً.
              </p>
            </div>

            {/* Official URL Bar + Quick Actions */}
            <div className="pt-1 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="flex-1 min-w-0 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-4 py-3 flex items-center justify-between gap-3">
                  <span
                    dir="ltr"
                    className="font-mono text-xs sm:text-sm font-semibold text-[#1F1F1C] truncate select-all"
                  >
                    {cleanOfficialReferralUrl}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    title="نسخ رمز الدعوة فقط"
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-[#E8DED2] hover:bg-[#D8C7B2]/70 border border-[#D8C7B2] text-[#D97757] font-mono text-[11px] font-bold transition-colors cursor-pointer"
                    dir="ltr"
                  >
                    {copiedCode ? 'Copied ✓' : cleanCode}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-5 py-3 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>تم نسخ الرابط ✓</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>نسخ الرابط الرسمي</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-[#E8DED2] hover:bg-[#D8C7B2]/70 border border-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-bold inline-flex items-center gap-2 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5 text-[#D97757]" />
                  <span>مشاركة الدعوة عبر واتساب</span>
                </a>
                <a
                  href={telegramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-[#E8DED2] hover:bg-[#D8C7B2]/70 border border-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-bold inline-flex items-center gap-2 transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-[#D97757]" />
                  <span>مشاركة عبر تيليجرام</span>
                </a>
              </div>
            </div>
          </div>

          {/* Instant Mini QR Card */}
          <div className="shrink-0 flex sm:flex-row xl:flex-col items-center justify-between xl:justify-center gap-4 rounded-2xl bg-[#E8DED2] border border-[#D8C7B2] p-4 sm:p-5">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] p-2 flex items-center justify-center shadow-inner shrink-0">
              {miniQrDataUrl ? (
                <img
                  src={miniQrDataUrl}
                  alt={`رمز QR لسفير جذوري ${cleanCode}`}
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <Sparkles className="w-6 h-6 text-[#D97757]/50" />
              )}
            </div>
            <div className="text-right xl:text-center space-y-1">
              <div className="text-[11px] font-semibold text-[#D97757]">
                امسح الرمز للانضمام الفوري
              </div>
              <div dir="ltr" className="text-xs font-mono font-bold text-[#1F1F1C]">
                {cleanCode}
              </div>
              <div className="text-[10px] text-[#1F1F1C]/65">
                مرتبط تلقائياً بمكافآت عائلة {familyName}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual 3-Step Dual Reward Flow */}
      <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-5 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          <div className="flex items-start gap-3.5 rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] p-4">
            <div className="w-9 h-9 rounded-xl bg-[#D97757] text-[#F5F1E8] font-display font-bold text-sm flex items-center justify-center shrink-0 tabular-nums">
              1
            </div>
            <div className="space-y-1">
              <div className="text-xs font-display font-bold text-[#1F1F1C]">
                شارك رابطك الرسمي أو رمز QR
              </div>
              <p className="text-[11px] text-[#1F1F1C]/70 leading-relaxed">
                أرسل رابط{' '}
                <span dir="ltr" className="font-mono font-semibold text-[#D97757]">
                  {ACTIVE_PUBLIC_SITE_DISPLAY_HOST}
                </span>{' '}
                في مجالس العائلة والأصدقاء لتأسيس شجراتهم مجاناً.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] p-4">
            <div className="w-9 h-9 rounded-xl bg-[#D97757] text-[#F5F1E8] font-display font-bold text-sm flex items-center justify-center shrink-0 tabular-nums">
              2
            </div>
            <div className="space-y-1">
              <div className="text-xs font-display font-bold text-[#1F1F1C]">
                هدية التأسيس المجاني (+{AMBASSADOR_REWARDS_CONFIG.capacityBonusPerFreeInvite} مقعد سعة)
              </div>
              <p className="text-[11px] text-[#1F1F1C]/70 leading-relaxed">
                عن كل مدعو ينشئ حسابه المجاني تكسب{' '}
                <strong className="text-[#1F1F1C]">+{AMBASSADOR_REWARDS_CONFIG.capacityBonusPerFreeInvite} مقعداً في شجرتي و+{AMBASSADOR_REWARDS_CONFIG.capacityBonusPerFreeInvite} مقتنى في خزانتي</strong>{' '}
                (حتى سقف +{AMBASSADOR_REWARDS_CONFIG.maxFreeCapacityBonus} مقعد إضافي).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] p-4">
            <div className="w-9 h-9 rounded-xl bg-[#D97757] text-[#F5F1E8] font-display font-bold text-sm flex items-center justify-center shrink-0 tabular-nums">
              3
            </div>
            <div className="space-y-1">
              <div className="text-xs font-display font-bold text-[#1F1F1C]">
                هدية التمديد المجاني (+{AMBASSADOR_REWARDS_CONFIG.freeMonthsPerPaidSubscriber} شهر اشتراك مجاني)
              </div>
              <p className="text-[11px] text-[#1F1F1C]/70 leading-relaxed">
                عن كل مدعو يفعّل اشتراك <strong className="text-[#D97757]">Basic أو Premium</strong> يُضاف تلقائياً{' '}
                <strong className="text-[#1F1F1C]">شهر اشتراك مجاني كامل</strong> يمدد باقتك (أو يمنحك شهر Basic هدية إن كنت على المجانية).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Non-Cash High-Value Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-[#FAF7F2] border border-[#D8C7B2] p-5 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#1F1F1C]/70">
              إجمالي المنضمين برابطك
            </div>
            <div className="text-3xl font-display font-extrabold text-[#1F1F1C] tabular-nums">
              {referralStats.registeredCount}
            </div>
            <div className="text-[11px] text-[#1F1F1C]/60">
              الأقارب والأصدقاء المرتبطون برمز سفيرك
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl bg-[#FAF7F2] border border-[#D8C7B2] p-5 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#1F1F1C]/70">
              مقاعد السعة الإضافية المكتسبة
            </div>
            <div className="text-3xl font-display font-extrabold text-[#1F1F1C] tabular-nums">
              +{rewards.earnedCapacityBonus}{' '}
              <span className="text-sm font-bold text-[#D97757]">مقعد</span>
            </div>
            <div className="text-[11px] text-[#1F1F1C]/60">
              تُضاف تلقائياً لسعة «شجرتي» و«خزانتي» (سقف +{rewards.maxCapacityBonus})
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl bg-[#FAF7F2] border border-[#D8C7B2] p-5 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#1F1F1C]/70">
              الأشهر المجانية المكتسبة
            </div>
            <div className="text-3xl font-display font-extrabold text-[#D97757] tabular-nums">
              +{rewards.earnedFreeMonths}{' '}
              <span className="text-sm font-bold text-[#1F1F1C]">شهر مجاني</span>
            </div>
            <div className="text-[11px] text-[#1F1F1C]/60">
              تمديد تلقائي لباقتك (أو شهر Basic هدية للمجاني)
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
            <CalendarPlus className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Real Invitees Table (Zero Mockups) */}
      <div className="rounded-2xl bg-[#FAF7F2] border border-[#D8C7B2] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#D8C7B2]/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#D97757]" />
            <h4 className="text-sm font-display font-bold text-[#1F1F1C]">
              سجل المدعوين وحالة الاستحقاق
            </h4>
          </div>
          <span className="text-xs text-[#1F1F1C]/65 tabular-nums">
            {referralStats.invitees.length} سجل فعلي
          </span>
        </div>

        {referralStats.invitees.length === 0 ? (
          <div className="p-8 sm:p-10 text-center space-y-3 bg-[#F5F1E8]/50">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF7F2] border border-[#D8C7B2] mx-auto flex items-center justify-center text-[#D97757]">
              <Gift className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h5 className="text-sm font-display font-bold text-[#1F1F1C]">
                لم يسجّل أحد عبر رابط سفيرك بعد
              </h5>
              <p className="text-xs text-[#1F1F1C]/70 leading-relaxed">
                شارك رابطك الرسمي أعلاه مع أبناء عمومتك وأصدقائك لتربح فوراً +{AMBASSADOR_REWARDS_CONFIG.capacityBonusPerFreeInvite} مقعد سعة عن كل تسجيل مجاني و+{AMBASSADOR_REWARDS_CONFIG.freeMonthsPerPaidSubscriber} شهر اشتراك مجاني عن كل ترقية.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-[#F5F1E8] border-b border-[#D8C7B2] text-[11px] font-display font-bold text-[#1F1F1C]/75">
                  <th className="py-3 px-5">المدعو</th>
                  <th className="py-3 px-5">تاريخ الانضمام</th>
                  <th className="py-3 px-5">حالة الاستحقاق والمكافأة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8C7B2]/60 text-xs">
                {referralStats.invitees.map((inv) => (
                  <tr
                    key={inv.userId}
                    className="hover:bg-[#F5F1E8]/60 transition-colors"
                  >
                    <td className="py-3.5 px-5 font-display font-bold text-[#1F1F1C]">
                      {inv.fullName}
                    </td>
                    <td className="py-3.5 px-5 text-[#1F1F1C]/65 tabular-nums">
                      {new Date(inv.createdAt).toLocaleDateString('ar-SA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-5">
                      {inv.status === 'REWARDED_10_USD' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] font-bold text-[11px]">
                          <span>مشترك فعّال · منحك +1 شهر مجاني ✓</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F5F1E8] border border-[#D97757]/35 text-[#D97757] font-semibold text-[11px]">
                          <span>
                            مسجل مجاناً · منحك +{AMBASSADOR_REWARDS_CONFIG.capacityBonusPerFreeInvite} مقعد سعة · بانتظار الترقية لربح شهر مجاني
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
