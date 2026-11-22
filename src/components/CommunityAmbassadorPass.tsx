import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Award,
  Check,
  Copy,
  Gift,
  Send,
  Share2,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import {
  ACTIVE_PUBLIC_SITE_DISPLAY_HOST,
  REFERRAL_REWARD_USD,
  resolveClientPublicAppBaseUrl,
} from '../config/referralAndSiteConfig';
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
  // Always display and share the active public domain configured centrally
  const cleanOfficialReferralUrl = `${resolveClientPublicAppBaseUrl()}/?ref=${encodeURIComponent(cleanCode)}`;

  const craftedArabicShareText = `أدعوك لتوثيق شجرة عائلتك واستكشاف عمود نسبك الموثق عبر منصة «جذوري» لحفظ الإرث العائلي العربي ✦\nسجّل عبر رابط الدعوة الخاص بي من أسرة ${familyName}:\n${cleanOfficialReferralUrl}`;

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(craftedArabicShareText)}`;
  const telegramHref = `https://t.me/share/url?url=${encodeURIComponent(
    cleanOfficialReferralUrl
  )}&text=${encodeURIComponent(
    `أدعوك لتوثيق شجرة عائلتك واكتشاف جذورك عبر منصة «جذوري» ✦ (دعوة من أسرة ${familyName})`
  )}`;

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(cleanOfficialReferralUrl, {
      width: 220,
      margin: 1,
      color: {
        dark: '#1C1917',
        light: '#FAF6EE',
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
        `تم نسخ رابط الإحالة الرسمي ${cleanOfficialReferralUrl}`
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
      {/* Black & Gold VIP Ambassador Pass */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-bl from-[#1A1816] via-[#25221E] to-[#171513] border border-[#D4AF6A]/45 text-[#F7F2E9] shadow-lg">
        {/* Subtle engraved gold filigree top rim */}
        <div
          className="h-1 w-full bg-gradient-to-l from-[#8D4925] via-[#E5C17A] to-[#B98A78]"
          aria-hidden="true"
        />

        <div className="p-6 sm:p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          {/* Left/Main Pass Identity & Copy */}
          <div className="space-y-4 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span className="inline-flex items-center gap-1.5 font-display font-bold text-[#E5C17A] tracking-wide">
                <Award className="w-4 h-4 text-[#E5C17A]" aria-hidden="true" />
                بطاقة سفير جذوري المعتمد
              </span>
              <span className="text-[#F7F2E9]/30">·</span>
              <span className="text-[#F7F2E9]/70">
                مكافأة محفظة ذرية فورية{' '}
                <span dir="ltr" className="inline-block font-mono font-bold text-[#E5C17A] tabular-nums">
                  +${REFERRAL_REWARD_USD}
                </span>
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-display font-bold text-white leading-snug">
                شارك إرث «جذوري» واحصل على{' '}
                <span dir="ltr" className="inline-block text-[#E5C17A] tabular-nums">
                  +${REFERRAL_REWARD_USD}
                </span>{' '}
                فوراً في محفظتك عن كل مشترك سنوي
              </h3>
              <p className="text-xs sm:text-sm text-[#F7F2E9]/75 leading-relaxed max-w-2xl">
                عندما ينضم أحد أقاربك أو أصدقائك عبر رابط سفيرك الرسمي ويفعّل أول اشتراك سنوي له، تُودع المكافأة آلياً في محفظتك لتستخدمها في فتح الكبسولات التاريخية أو تجديد عضويتك.
              </p>
            </div>

            {/* Clean Official URL Bar + Quick Actions */}
            <div className="pt-1 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="flex-1 min-w-0 rounded-xl bg-black/45 border border-[#D4AF6A]/35 px-4 py-3 flex items-center justify-between gap-3">
                  <span
                    dir="ltr"
                    className="font-mono text-xs sm:text-sm font-semibold text-[#F7F2E9] truncate select-all"
                  >
                    {cleanOfficialReferralUrl}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    title="نسخ رمز الدعوة فقط"
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-[#D4AF6A]/15 hover:bg-[#D4AF6A]/25 border border-[#D4AF6A]/30 text-[#E5C17A] font-mono text-[11px] font-bold transition-colors cursor-pointer"
                    dir="ltr"
                  >
                    {copiedCode ? 'Copied ✓' : cleanCode}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-5 py-3 rounded-xl bg-[#D4AF6A] hover:bg-[#c6a05b] text-[#1A1816] text-xs font-display font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
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
                  className="px-4 py-2 rounded-xl bg-[#1F6E43] hover:bg-[#195a36] text-white text-xs font-display font-bold inline-flex items-center gap-2 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>مشاركة الدعوة عبر واتساب</span>
                </a>
                <a
                  href={telegramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-[#25638A] hover:bg-[#1e5171] text-white text-xs font-display font-bold inline-flex items-center gap-2 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>مشاركة عبر تيليجرام</span>
                </a>
              </div>
            </div>
          </div>

          {/* Right/End Instant Mini QR Card */}
          <div className="shrink-0 flex sm:flex-row xl:flex-col items-center justify-between xl:justify-center gap-4 rounded-2xl bg-white/[0.06] border border-[#D4AF6A]/30 p-4 sm:p-5">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl bg-[#FAF6EE] p-2 flex items-center justify-center shadow-inner shrink-0">
              {miniQrDataUrl ? (
                <img
                  src={miniQrDataUrl}
                  alt={`رمز QR لسفير جذوري ${cleanCode}`}
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <Sparkles className="w-6 h-6 text-[#8D4925]/50" />
              )}
            </div>
            <div className="text-right xl:text-center space-y-1">
              <div className="text-[11px] font-semibold text-[#E5C17A]">
                امسح الرمز للانضمام الفوري
              </div>
              <div dir="ltr" className="text-xs font-mono font-bold text-white">
                {cleanCode}
              </div>
              <div className="text-[10px] text-[#F7F2E9]/60">
                مرتبط تلقائياً بمحفظة أسرة {familyName}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual 3-Step Reward Flow */}
      <div className="rounded-2xl bg-white border border-[#B98A78]/35 p-5 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          <div className="flex items-start gap-3.5 rounded-xl bg-[#FAF6EE] border border-[#B98A78]/25 p-4">
            <div className="w-9 h-9 rounded-xl bg-[#252321] text-[#E5C17A] font-display font-bold text-sm flex items-center justify-center shrink-0 tabular-nums">
              1
            </div>
            <div className="space-y-1">
              <div className="text-xs font-display font-bold text-[#252321]">
                شارك رابطك الرسمي
              </div>
              <p className="text-[11px] text-[#252321]/65 leading-relaxed">
                أرسل رابط <span dir="ltr" className="font-mono font-semibold text-[#8D4925]">{ACTIVE_PUBLIC_SITE_DISPLAY_HOST}</span> أو اعرض رمز QR في مجالس الأسرة والأصدقاء.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-xl bg-[#FAF6EE] border border-[#B98A78]/25 p-4">
            <div className="w-9 h-9 rounded-xl bg-[#8D4925] text-white font-display font-bold text-sm flex items-center justify-center shrink-0 tabular-nums">
              2
            </div>
            <div className="space-y-1">
              <div className="text-xs font-display font-bold text-[#252321]">
                يسجّل قريبك أو صديقك
              </div>
              <p className="text-[11px] text-[#252321]/65 leading-relaxed">
                يُربط حسابه تلقائياً برمز دعوتك فور التسجيل المجاني ويظهر في سجلك أدناه.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-xl bg-[#FAF6EE] border border-[#B98A78]/25 p-4">
            <div className="w-9 h-9 rounded-xl bg-[#D8755B] text-white font-display font-bold text-sm flex items-center justify-center shrink-0 tabular-nums">
              3
            </div>
            <div className="space-y-1">
              <div className="text-xs font-display font-bold text-[#252321]">
                يفعّل اشتراكه السنوي فتُودع{' '}
                <span dir="ltr" className="inline-block font-mono font-bold text-[#8D4925] tabular-nums">
                  $10
                </span>{' '}
                فوراً
              </div>
              <p className="text-[11px] text-[#252321]/65 leading-relaxed">
                تضاف المكافأة مباشرة لرصيد محفظتك وتُسجّل كقيد مالي موثق قابل للاستخدام الفوري.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Formatted Metric Cards (Strict LTR Currency Formatting) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-[#B98A78]/35 p-5 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#252321]/65">
              إجمالي المسجلين برابطك
            </div>
            <div className="text-3xl font-display font-bold text-[#252321] tabular-nums">
              {referralStats.registeredCount}
            </div>
            <div className="text-[11px] text-[#252321]/55">
              الحسابات المرتبطة برمز سفيرك
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F7F2E9] text-[#252321] flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-[#B98A78]/35 p-5 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#252321]/65">
              المشتركون السنويون المؤهلون
            </div>
            <div className="text-3xl font-display font-bold text-[#8D4925] tabular-nums">
              {referralStats.rewardedAnnualCount}
            </div>
            <div className="text-[11px] text-[#252321]/55">
              عن كل مشترك مكافأة{' '}
              <span dir="ltr" className="inline-block font-mono font-semibold text-[#8D4925]">
                +${REFERRAL_REWARD_USD}
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#8D4925]/10 text-[#8D4925] flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-[#D4AF6A]/45 p-5 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#252321]/65">
              إجمالي المكافآت المودعة بالمحفظة
            </div>
            <div
              dir="ltr"
              className="text-3xl font-display font-bold text-[#D8755B] tabular-nums text-right"
            >
              ${referralStats.totalEarnedUsd.toFixed(2)}
            </div>
            <div className="text-[11px] text-[#252321]/55">
              رصيد معتمد في سجل معاملات محفظتك
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#D8755B]/12 text-[#D8755B] flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Real Invitees Table (Zero Mockups) */}
      <div className="rounded-2xl bg-white border border-[#B98A78]/35 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#B98A78]/25 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#8D4925]" />
            <h4 className="text-sm font-display font-bold text-[#252321]">
              سجل المدعوين وحالة الاستحقاق
            </h4>
          </div>
          <span className="text-xs text-[#252321]/60 tabular-nums">
            {referralStats.invitees.length} سجل فعلي
          </span>
        </div>

        {referralStats.invitees.length === 0 ? (
          <div className="p-8 sm:p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/30 mx-auto flex items-center justify-center text-[#8D4925]">
              <Gift className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h5 className="text-sm font-display font-bold text-[#252321]">
                لم يسجّل أحد عبر رابط سفيرك بعد
              </h5>
              <p className="text-xs text-[#252321]/65 leading-relaxed">
                ابدأ بمشاركة رابطك الرسمي أعلاه مع أبناء عمومتك وأصدقائك عبر واتساب أو تيليجرام، وسيظهر كل منضم وحالة مكافأته هنا لحظياً.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-[#FAF6EE] border-b border-[#B98A78]/25 text-[11px] font-display font-bold text-[#252321]/70">
                  <th className="py-3 px-5">المدعو</th>
                  <th className="py-3 px-5">تاريخ الانضمام</th>
                  <th className="py-3 px-5">حالة الاستحقاق والمكافأة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#B98A78]/20 text-xs">
                {referralStats.invitees.map((inv) => (
                  <tr
                    key={inv.userId}
                    className="hover:bg-[#FAF6EE]/60 transition-colors"
                  >
                    <td className="py-3.5 px-5 font-display font-bold text-[#252321]">
                      {inv.fullName}
                    </td>
                    <td className="py-3.5 px-5 text-[#252321]/65 tabular-nums">
                      {new Date(inv.createdAt).toLocaleDateString('ar-SA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-5">
                      {inv.status === 'REWARDED_10_USD' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-900/10 text-emerald-900 font-bold text-[11px]">
                          <span>مفعّل سنوياً · أُودعت</span>
                          <span dir="ltr" className="font-mono tabular-nums">
                            +${REFERRAL_REWARD_USD}
                          </span>
                          <span>✓</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-900/10 text-[#8D4925] font-semibold text-[11px]">
                          <span>مسجل مجاناً · بانتظار الترقية السنوية</span>
                          <span dir="ltr" className="font-mono tabular-nums">
                            (+${REFERRAL_REWARD_USD})
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
