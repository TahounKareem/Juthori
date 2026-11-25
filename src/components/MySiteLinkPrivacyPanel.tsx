import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Lock,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import {
  FemaleDisplayPolicy,
  SiteAccessMode,
} from '../services/priority4Service';
import { ModernSwitch } from './MySiteStudioControls';

interface MySiteLinkPrivacyPanelProps {
  officialBrandHost: string;
  siteSlug: string;
  cleanSlugDisplay: string;
  onChangeSiteSlug: (nextSlug: string) => void;
  slugStatus: {
    checking: boolean;
    available?: boolean;
    message?: string;
  };
  onCheckSlug: () => void;
  copiedUrl: boolean;
  onCopyPortalUrl: () => void;
  onOpenQrModal: () => void;
  siteAccessMode: SiteAccessMode;
  onChangeSiteAccessMode: (mode: SiteAccessMode) => void;
  familyAccessCode: string;
  onChangeFamilyAccessCode: (code: string) => void;
  femaleDisplayPolicy: FemaleDisplayPolicy;
  onChangeFemaleDisplayPolicy: (policy: FemaleDisplayPolicy) => void;
  hideLivingNamesForGuests: boolean;
  onChangeHideLivingNamesForGuests: (next: boolean) => void;
  hideLivingBirthDates: boolean;
  onChangeHideLivingBirthDates: (next: boolean) => void;
  allowCircleMembersEnrichment: boolean;
  onChangeAllowCircleMembersEnrichment: (next: boolean) => void;
  allowVisitorEnrichment: boolean;
  onChangeAllowVisitorEnrichment: (next: boolean) => void;
  majlisEnabled: boolean;
  onChangeMajlisEnabled: (next: boolean) => void;
}

const ACCESS_MODE_OPTIONS: ReadonlyArray<{
  id: SiteAccessMode;
  title: string;
  desc: string;
}> = [
  {
    id: 'PUBLIC',
    title: 'بوابة عامة',
    desc: 'مفتوحة لجميع الزوار وأبناء العائلة مع إمكانية الأرشفة عبر الرابط المباشر.',
  },
  {
    id: 'UNLISTED',
    title: 'رابط خاص غير مفهرس',
    desc: 'لا تظهر في محركات البحث ولا يفتحها إلا من تشارك معه رابط الديوان.',
  },
  {
    id: 'PRIVATE_WHITELIST',
    title: 'محمي لدائرة العائلة برمز دخول',
    desc: 'حصري لأعضاء «مجتمعي» الموثقين أو حاملي رمز الدخول العائلي السري.',
  },
];

const FEMALE_DISPLAY_OPTIONS: ReadonlyArray<{
  id: FemaleDisplayPolicy;
  title: string;
  desc: string;
}> = [
  {
    id: 'SHOW_ALL',
    title: 'إظهار الأسماء الكاملة',
    desc: 'تُعرض الأسماء كما هي موثقة في «شجرتي».',
  },
  {
    id: 'SYMBOLIC_TITLE',
    title: 'لقب رمزي (كريمة / سيدة)',
    desc: 'يُعرض اللقب الرمزي فقط حفاظاً على خصوصية العائلة.',
  },
  {
    id: 'FAMILY_CIRCLE_ONLY',
    title: 'لدائرة العائلة فقط',
    desc: 'تُخفى عن الضيوف وتظهر لأعضاء الدائرة الموثقين.',
  },
  {
    id: 'HIDE_ALL',
    title: 'إخفاء كامل في الموقع العام',
    desc: 'لا تُعرض في الشجرة المنشورة مع بقائها محفوظة في «شجرتي».',
  },
];

export const MySiteLinkPrivacyPanel: React.FC<MySiteLinkPrivacyPanelProps> = ({
  officialBrandHost,
  siteSlug,
  cleanSlugDisplay,
  onChangeSiteSlug,
  slugStatus,
  onCheckSlug,
  copiedUrl,
  onCopyPortalUrl,
  onOpenQrModal,
  siteAccessMode,
  onChangeSiteAccessMode,
  familyAccessCode,
  onChangeFamilyAccessCode,
  femaleDisplayPolicy,
  onChangeFemaleDisplayPolicy,
  hideLivingNamesForGuests,
  onChangeHideLivingNamesForGuests,
  hideLivingBirthDates,
  onChangeHideLivingBirthDates,
  allowCircleMembersEnrichment,
  onChangeAllowCircleMembersEnrichment,
  allowVisitorEnrichment,
  onChangeAllowVisitorEnrichment,
  majlisEnabled,
  onChangeMajlisEnabled,
}) => {
  const [showCodePlain, setShowCodePlain] = useState(false);

  return (
    <div className="space-y-4" data-testid="mysite-pillar-link-privacy">
      {/* ================================================================= */}
      {/* 1. DIRECT PORTAL URL & QR INVITATION                              */}
      {/* ================================================================= */}
      <section className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[13.5px] font-display font-extrabold text-[#1F1F1C]">
                الرابط المباشر لبوابة العائلة
              </h3>
              <p className="text-[11px] text-[#D97757]">
                اختر اسماً نظيفاً وسهل المشاركة في مجموعات العائلة وبطاقات الدعوة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenQrModal}
            className="h-9 px-3.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <QrCode className="w-3.5 h-3.5 text-[#D97757]" />
            <span>بطاقة الدعوة وQR</span>
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <div
              dir="ltr"
              className="flex-1 flex items-center rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3 h-10 focus-within:border-[#D97757] focus-within:bg-[#F5F1E8] transition-colors"
            >
              <span className="text-xs font-mono font-semibold text-[#D97757] select-none shrink-0">
                {officialBrandHost}/
              </span>
              <input
                type="text"
                value={siteSlug}
                onChange={(e) => onChangeSiteSlug(e.target.value)}
                placeholder="al-family"
                aria-label="معرف رابط بوابة العائلة"
                className="flex-1 bg-transparent px-1.5 text-xs font-mono font-bold text-[#1F1F1C] focus:outline-none min-w-0"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onCheckSlug}
                disabled={slugStatus.checking}
                className="h-10 px-3.5 rounded-xl bg-[#1F1F1C] hover:bg-[#1F1F1C]/90 text-[#D97757] text-xs font-display font-bold cursor-pointer disabled:opacity-60 transition-colors whitespace-nowrap"
              >
                {slugStatus.checking ? 'جاري الفحص...' : 'فحص التوفر'}
              </button>
              <button
                type="button"
                onClick={onCopyPortalUrl}
                className="h-10 px-3.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#D97757]" />
                    <span className="text-[#1F1F1C]">تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#D97757]" />
                    <span>نسخ الرابط</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span dir="ltr" className="font-mono text-[#D97757]">
              https://{officialBrandHost}/{cleanSlugDisplay}
            </span>
            {slugStatus.message && (
              <span
                className={`font-bold ${
                  slugStatus.available ? 'text-[#D97757]' : 'text-[#D97757]'
                }`}
              >
                {slugStatus.message}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 2. ACCESS SCOPE + FAMILY SECRET ACCESS CODE                       */}
      {/* ================================================================= */}
      <section className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-[13.5px] font-display font-extrabold text-[#1F1F1C]">
              نطاق الوصول لبوابة العائلة
            </h3>
            <p className="text-[11px] text-[#D97757]">
              حدّد من يمكنه فتح الموقع واستعراض محتوى ديوان العائلة
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {ACCESS_MODE_OPTIONS.map((opt) => {
            const active = siteAccessMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeSiteAccessMode(opt.id)}
                className={`rounded-xl p-3.5 border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  active
                    ? 'bg-[#F5F1E8] border-[#D97757] ring-1 ring-[#D97757]/35'
                    : 'bg-[#F5F1E8] border-[#D8C7B2] hover:border-[#D8C7B2]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-display font-extrabold text-[#1F1F1C]">
                    {opt.title}
                  </span>
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      active
                        ? 'border-[#D97757] bg-[#D97757] text-[#F5F1E8]'
                        : 'border-[#D8C7B2] bg-[#F5F1E8]'
                    }`}
                  >
                    {active && <Check className="w-2.5 h-2.5" />}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-[#D97757]">
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>

        {siteAccessMode === 'PRIVATE_WHITELIST' && (
          <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-display font-extrabold text-[#D97757]">
                <KeyRound className="w-4 h-4 text-[#D97757]" />
                <span>رمز الدخول السري للعائلة *</span>
              </div>
              {familyAccessCode.trim() ? (
                <span className="text-[11px] font-bold text-[#1F1F1C]">
                  ✓ رمز حماية مفعّل
                </span>
              ) : (
                <span className="text-[11px] font-bold text-[#1F1F1C]">
                  مطلوب لهذا النطاق
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#D97757] leading-relaxed">
              عيّن رمزاً عائلياً سرياً يُطلب من الزوار في بوابة الحماية قبل فتح
              ديوان العائلة، إلى جانب الدخول التلقائي لأعضاء دائرة العائلة
              المعتمدين عبر حساباتهم في «جذوري».
            </p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showCodePlain ? 'text' : 'password'}
                  value={familyAccessCode}
                  onChange={(e) => onChangeFamilyAccessCode(e.target.value)}
                  placeholder="مثال: 1984 أو DIWAN-2026"
                  aria-label="رمز الدخول السري للعائلة"
                  required
                  className={`w-full h-10 rounded-xl bg-[#F5F1E8] border px-3.5 pl-10 text-xs font-mono font-bold text-[#1F1F1C] focus:outline-none ${
                    familyAccessCode.trim()
                      ? 'border-[#D8C7B2] focus:border-[#D97757]'
                      : 'border-[#D97757] focus:border-[#D97757]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowCodePlain((v) => !v)}
                  title={showCodePlain ? 'إخفاء الرمز' : 'إظهار الرمز'}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#D97757] hover:text-[#1F1F1C] cursor-pointer"
                >
                  {showCodePlain ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {familyAccessCode && (
                <button
                  type="button"
                  onClick={() => onChangeFamilyAccessCode('')}
                  className="h-10 px-3 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[11px] font-bold text-[#D97757] cursor-pointer whitespace-nowrap"
                >
                  مسح الرمز
                </button>
              )}
            </div>
            {!familyAccessCode.trim() ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] px-3 py-2 text-[11px] font-medium text-[#1F1F1C]"
              >
                <AlertTriangle className="w-4 h-4 text-[#D97757] shrink-0 mt-0.5" />
                <span>
                  يرجى كتابة «رمز الدخول السري للعائلة» قبل الضغط على «حفظ مسودة»
                  أو «تحديث ونشر الموقع» لتفعيل بوابة الحماية للزوار بشكل كامل.
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-[#1F1F1C] font-medium">
                سيتم تشفير هذا الرمز وحفظه مع إعدادات الموقع فوراً عند الضغط على «حفظ مسودة» أو «تحديث ونشر الموقع».
              </p>
            )}
          </div>
        )}
      </section>

      {/* ================================================================= */}
      {/* 3. PRIVACY & FAMILY PARTICIPATION CONTROLS                        */}
      {/* ================================================================= */}
      <section className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-[13.5px] font-display font-extrabold text-[#1F1F1C]">
              ضوابط الخصوصية والمشاركة العائلية
            </h3>
            <p className="text-[11px] text-[#D97757]">
              تحكم دقيق في عرض بيانات الأحياء والنساء وتفاعل الزوار مع الديوان
            </p>
          </div>
        </div>

        {/* Female display policy */}
        <div className="space-y-2">
          <label className="text-xs font-display font-extrabold text-[#1F1F1C]">
            سياسة عرض أسماء الإناث في الشجرة المنشورة
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FEMALE_DISPLAY_OPTIONS.map((opt) => {
              const active = femaleDisplayPolicy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeFemaleDisplayPolicy(opt.id)}
                  className={`rounded-xl px-3.5 py-2.5 border text-right transition-all cursor-pointer ${
                    active
                      ? 'bg-[#F5F1E8] border-[#D97757] ring-1 ring-[#D97757]/30'
                      : 'bg-[#F5F1E8] border-[#D8C7B2] hover:border-[#D8C7B2]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-display font-bold text-[#1F1F1C]">
                      {opt.title}
                    </span>
                    {active && (
                      <Check className="w-3.5 h-3.5 text-[#D97757] shrink-0" />
                    )}
                  </div>
                  <p className="text-[10.5px] text-[#D97757] mt-0.5 leading-relaxed">
                    {opt.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Toggle switches list */}
        <div className="divide-y divide-[#D8C7B2] rounded-xl border border-[#D8C7B2] bg-[#F5F1E8]/70">
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-display font-bold text-[#1F1F1C]">
                حجب أسماء الأحياء عن الزوار
              </div>
              <p className="text-[11px] text-[#D97757] mt-0.5">
                يُستبدل اسم الفرد الحي بوصف خصوصي للضيوف خارج دائرة العائلة
              </p>
            </div>
            <ModernSwitch
              checked={hideLivingNamesForGuests}
              onChange={onChangeHideLivingNamesForGuests}
              ariaLabel="حجب أسماء الأحياء عن الزوار"
            />
          </div>

          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-display font-bold text-[#1F1F1C]">
                إخفاء سنوات ميلاد الأحياء
              </div>
              <p className="text-[11px] text-[#D97757] mt-0.5">
                حماية تواريخ ميلاد أفراد العائلة الأحياء من الظهور في البوابة
                العامة
              </p>
            </div>
            <ModernSwitch
              checked={hideLivingBirthDates}
              onChange={onChangeHideLivingBirthDates}
              ariaLabel="إخفاء سنوات ميلاد الأحياء"
            />
          </div>

          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-display font-bold text-[#1F1F1C]">
                السماح لأفراد دائرة العائلة المعتمدين في مجتمعي باقتراح إثراء الشجرة والخزانة
              </div>
              <p className="text-[11px] text-[#D97757] mt-0.5">
                يتيح لأعضاء دائرة العائلة ومساعد أمين السجل اقتراح إضافة فروع للشجرة أو إهداء صور للخزانة لمراجعتها
              </p>
            </div>
            <ModernSwitch
              checked={allowCircleMembersEnrichment}
              onChange={onChangeAllowCircleMembersEnrichment}
              ariaLabel="السماح لأفراد دائرة العائلة المعتمدين في مجتمعي باقتراح إثراء الشجرة والخزانة"
            />
          </div>

          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-display font-bold text-[#1F1F1C]">
                السماح للزوار باقتراح إثراء الشجرة والخزانة
              </div>
              <p className="text-[11px] text-[#D97757] mt-0.5">
                يتيح لعموم الزوار اقتراح إضافة فروع للشجرة أو إهداء صور للخزانة تصل إليك للمراجعة قبل الاعتماد
              </p>
            </div>
            <ModernSwitch
              checked={allowVisitorEnrichment}
              onChange={onChangeAllowVisitorEnrichment}
              ariaLabel="السماح للزوار باقتراح إثراء الشجرة والخزانة"
            />
          </div>

          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-display font-bold text-[#1F1F1C]">
                تفعيل مشاركات وحوارات مجلس العائلة
              </div>
              <p className="text-[11px] text-[#D97757] mt-0.5">
                إتاحة قسم «مجلس العائلة ولوحة حراس الذاكرة» للنقاشات الأسبوعية
                وصلة الرحم
              </p>
            </div>
            <ModernSwitch
              checked={majlisEnabled}
              onChange={onChangeMajlisEnabled}
              ariaLabel="تفعيل مشاركات وحوارات مجلس العائلة"
            />
          </div>
        </div>

        {/* Subtle heritage privacy guarantee */}
        <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2.5 flex items-center gap-2.5 text-[11px] text-[#D97757]">
          <ShieldCheck className="w-4 h-4 text-[#D97757] shrink-0" />
          <span>
            تُحفظ سلسلة <strong>عمود نسبي</strong> التاريخية الموثقة بمعزل تام
            داخل لوحتك الخاصة ولا تُنشر للعامة؛ يقتصر «موقعي» على دوحة الأسرة
            المعاصرة والمحتوى الذي تعتمد إظهاره.
          </span>
        </div>
      </section>
    </div>
  );
};
