import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Database,
  Globe,
  Menu,
  ShieldCheck,
  Lock,
  GitBranch,
  Archive,
  Layout,
  Search,
  Users,
  CheckCircle2,
  Send,
  X,
  ArrowLeft,
} from 'lucide-react';
import { JuthoriLogo } from './JuthoriLogo';
import { ResilientImage } from './ResilientImage';
import { JUTHORI_MEDIA } from '../assets/media';
import {
  ARAB_COUNTRIES_22,
  ORIGIN_COUNTRY_OPTIONS,
  getCountryInfoByName,
} from '../data/arabCountries';
import {
  AccountLegalType,
  RegistrationFormState,
  SilentGeoMetadata,
} from '../types/juthori';
import {
  validateStep1LineageForm,
} from '../utils/lineageEngine';

interface LandingPageProps {
  form: RegistrationFormState;
  onChangeForm: React.Dispatch<React.SetStateAction<RegistrationFormState>>;
  selectedPortalCountry: string;
  onSelectPortalCountry: (countryName: string) => void;
  onSubmitSearch: () => Promise<void>;
  isSearching: boolean;
  searchStep: 1 | 2 | 3;
  onOpenLogin: () => void;
  onOpenStaffPortal?: () => void;
  silentGeo: SilentGeoMetadata;
}

type PublicPageId =
  | 'home'
  | 'what-is-juthori'
  | 'about-us'
  | 'knowledge-center'
  | 'support-center';

const PUBLIC_NAV_ITEMS: Array<{ id: PublicPageId; label: string }> = [
  { id: 'home', label: 'الرئيسية' },
  { id: 'what-is-juthori', label: 'ما هو جذوري' },
  { id: 'about-us', label: 'من نحن' },
  { id: 'knowledge-center', label: 'المركز المعرفي' },
  { id: 'support-center', label: 'مركز التواصل والدعم' },
];

const CORE_STRENGTHS = [
  {
    number: '01',
    title: 'أدوات الاكتشاف',
    description: 'اكتشاف حقيقي — لا نعرض تخمينات أو نتائج غير مؤكدة، بل نربط اسم عائلتك بالعقد التاريخية المثبتة.',
    icon: Compass,
  },
  {
    number: '02',
    title: 'البيانات',
    description: 'أكثر من 2.27 مليون عقدة نسب ومصدر تاريخي مهيكل في قاعدة بيانات علائقية تغطي 22 دولة عربية والمهجر.',
    icon: Database,
  },
  {
    number: '03',
    title: 'الموثوقية',
    description: 'معلومات موثوقة معتمدة على مصادر ومشجرات محققة مع إسناد كل سلسلة إلى كتابها أو مخطوطتها الأصلية.',
    icon: ShieldCheck,
  },
  {
    number: '04',
    title: 'الخصوصية',
    description: 'خصوصيتك أولاً — بياناتك آمنة وسرية، ولا دفع مقدماً؛ البحث الأولي مجاني وتدفع فقط إذا وجدنا لك نتيجة.',
    icon: Lock,
  },
];

const PLATFORM_SERVICES_6 = [
  {
    number: '01',
    title: 'عمود النسب',
    subtitle: 'السلسلة التاريخية المحققة',
    description:
      'مسارات النسب، الروايات المختلفة، تعارض الروايات، البحث المباشر عن مصادر، المعلومات، والمنطقة الجغرافية التاريخية.',
    icon: GitBranch,
  },
  {
    number: '02',
    title: 'بناء الشجرة',
    subtitle: 'حصري لأمين السجل',
    description:
      'بناء شجرة بسيطة وديناميكية غير معقدة لإضافة أفراد العائلة وربطهم، مع خيارات تصدير وطباعة وتصميم الشجرة.',
    icon: Users,
  },
  {
    number: '03',
    title: 'خزانة الذاكرة',
    subtitle: 'أرشفة وترميم الوثائق',
    description:
      'وثّق واحفظ صور ووثائق العائلة في خزانة إلكترونية آمنة، مع محررات لترميم جودة الصور والوثائق ومزايا المشاركة.',
    icon: Archive,
  },
  {
    number: '04',
    title: 'موقع سجل العائلة على الإنترنت',
    subtitle: 'بوابة رقمية مستقلة للعائلة',
    description:
      'احصل على موقع أنيق لعائلتك لنشر شجرة العائلة وكل ما يخصها مع تحكم كامل بالنشر والخصوصية بدون خبرة تقنية.',
    icon: Layout,
  },
  {
    number: '05',
    title: 'الاكتشاف والإثراء',
    subtitle: 'تحديثات أرشيفية دورية',
    description:
      'اكتشاف دوري للمزيد عن عائلتك وتاريخها وشخصياتها والوثائق والروايات النسبية كلما فُهرست مخطوطات جديدة.',
    icon: Search,
  },
  {
    number: '06',
    title: 'المجتمعات',
    subtitle: 'تواصل الأرحام والباحثين',
    description:
      'تعرّف على المزيد عن أفراد وشخصيات من العائلة أو الأقارب، مع مشاركة الأبحاث والذكريات العائلية في بيئة موثوقة.',
    icon: Globe,
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  form,
  onChangeForm,
  selectedPortalCountry,
  onSelectPortalCountry,
  onSubmitSearch,
  isSearching,
  searchStep,
  onOpenLogin,
  onOpenStaffPortal,
}) => {
  const [activePublicPage, setActivePublicPage] = useState<PublicPageId>('home');
  const [showOptionalTribe, setShowOptionalTribe] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Partial<Record<keyof RegistrationFormState, string>>
  >({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Support form state
  const [supportName, setSupportName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSent, setSupportSent] = useState(false);
  const [supportError, setSupportError] = useState('');

  const countryInfo = getCountryInfoByName(selectedPortalCountry);

  // Global Scroll-to-Top Observer whenever activePublicPage changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activePublicPage]);

  const navigatePublicPage = (pageId: PublicPageId) => {
    setActivePublicPage(pageId);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const handleFieldChange = <K extends keyof RegistrationFormState>(
    key: K,
    value: RegistrationFormState[K]
  ) => {
    onChangeForm((prev) => ({ ...prev, [key]: value }));
    if (validationErrors[key]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateStep1LineageForm(form);
    if (!check.valid) {
      setValidationErrors(check.errors);
      return;
    }
    setValidationErrors({});
    await onSubmitSearch();
  };

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportName.trim() || !supportEmail.trim() || !supportMessage.trim()) {
      setSupportError('يرجى تعبئة الاسم والبريد الإلكتروني وتفاصيل الاستفسار.');
      return;
    }
    setSupportError('');
    setSupportSent(true);
    setSupportName('');
    setSupportEmail('');
    setSupportMessage('');
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F7F2E9] text-[#252321] flex flex-col justify-between">
      {/* A. Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="sticky top-0 z-40 bg-[#F7F2E9]/95 backdrop-blur-xs border-b border-[#B98A78]/30">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-6">
          {/* Right Zone: Juthori Logo */}
          <JuthoriLogo
            size="md"
            onClick={() => navigatePublicPage('home')}
          />

          {/* Center Zone: 5 Full-Page Exclusive Navigation Tabs */}
          <nav
            aria-label="التنقل الرئيسي"
            className="hidden lg:flex items-center gap-2 text-sm font-display font-bold"
          >
            {PUBLIC_NAV_ITEMS.map((item) => {
              const isActive = activePublicPage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigatePublicPage(item.id)}
                  className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#D8755B] text-white shadow-xs'
                      : 'text-[#252321]/85 hover:bg-[#EDE6DA] hover:text-[#252321]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Left Zone: Country/Slogan Switcher (22 Arab Countries) + Login Button */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative hidden sm:block">
              <label htmlFor="portal-country-switcher" className="sr-only">
                اختر الدولة العربية
              </label>
              <select
                id="portal-country-switcher"
                aria-label="بوابة الدول العربية الـ 22"
                value={selectedPortalCountry}
                onChange={(e) => {
                  const nextCountry = e.target.value;
                  onSelectPortalCountry(nextCountry);
                  handleFieldChange('originCountry', nextCountry);
                }}
                className="appearance-none rounded-xl bg-[#EDE6DA] border border-[#B98A78]/50 pr-3.5 pl-8 py-2 text-xs sm:text-sm font-semibold text-[#252321] focus:outline-none focus:border-[#D8755B] cursor-pointer"
              >
                {ARAB_COUNTRIES_22.map((country) => (
                  <option key={country.code} value={country.name}>
                    {country.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="w-4 h-4 text-[#252321]/70 pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
            </div>

            <button
              type="button"
              onClick={onOpenLogin}
              className="px-4 py-2 rounded-xl bg-[#252321] hover:bg-[#3a3734] text-[#F7F2E9] text-xs sm:text-sm font-display font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              تسجيل الدخول
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden w-10 h-10 rounded-xl bg-[#EDE6DA] flex items-center justify-center text-[#252321] cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#B98A78]/30 bg-[#F7F2E9] px-4 py-4 space-y-3">
            <div className="flex flex-col gap-1.5 text-sm font-display font-bold">
              {PUBLIC_NAV_ITEMS.map((item) => {
                const isActive = activePublicPage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigatePublicPage(item.id)}
                    className={`py-2.5 px-3.5 rounded-xl text-right transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#D8755B] text-white shadow-xs'
                        : 'text-[#252321] hover:bg-[#EDE6DA]'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="pt-2 border-t border-[#B98A78]/25">
              <label
                htmlFor="mobile-country-switcher"
                className="block text-xs font-medium text-[#252321]/70 mb-1"
              >
                بوابة الدول العربية (22 دولة):
              </label>
              <select
                id="mobile-country-switcher"
                value={selectedPortalCountry}
                onChange={(e) => {
                  onSelectPortalCountry(e.target.value);
                  handleFieldChange('originCountry', e.target.value);
                }}
                className="w-full rounded-xl bg-[#EDE6DA] border border-[#B98A78]/50 px-3 py-2 text-sm font-semibold text-[#252321]"
              >
                {ARAB_COUNTRIES_22.map((c) => (
                  <option key={c.code} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {activePublicPage === 'home' && (
          <section
            id="hero-portal"
            className="relative w-full overflow-hidden min-h-[780px] lg:min-h-[850px] flex items-center py-12 lg:py-16"
          >
            {/* Full-width screen architectural heritage image background */}
            <div className="absolute inset-0 z-0">
              <ResilientImage
                src={JUTHORI_MEDIA.heritageCourtyard}
                alt="العمارة التراثية العربية الأصيلة — جذوري"
                className="w-full h-full object-cover object-center scale-105"
              />
              {/* Rich atmospheric scrim ensuring contrast, warmth, and WCAG AA legibility */}
              <div className="absolute inset-0 bg-gradient-to-l from-[#252321]/95 via-[#252321]/90 to-[#252321]/92 backdrop-blur-[0.5px]" />
              <div className="absolute -top-32 right-1/4 w-[500px] h-[500px] bg-[#D8755B]/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-32 left-1/4 w-[500px] h-[500px] bg-[#B98A78]/15 rounded-full blur-3xl pointer-events-none" />
            </div>

            {/* Hero Foreground Content */}
            <div className="relative z-10 max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-8 lg:gap-12">
                {/* 1. RIGHT COLUMN (First in RTL layout): Distinctive Headline, Storytelling & Heritage */}
                <div className="lg:col-span-6 flex flex-col justify-center text-white space-y-6">
                  {/* Regional & National Portal Badge */}
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs sm:text-sm font-medium text-[#F7F2E9] w-fit shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-[#D8755B] animate-pulse" />
                    <span>بوابة الأنساب العربية الموثقة</span>
                    <span className="opacity-50" aria-hidden="true">·</span>
                    <span className="text-[#D8755B] font-semibold">{countryInfo.name}</span>
                    <span className="opacity-50" aria-hidden="true">·</span>
                    <span>22 دولة عربية</span>
                  </div>

                  {/* Major Display Headline */}
                  <div className="space-y-4">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold text-white leading-[1.22] tracking-tight text-balance">
                      هل نعرف جذورك؟<br />
                      <span className="text-[#D8755B] drop-shadow-sm">قصتك لم تبدأ بك.</span>
                    </h1>
                    <p className="text-base sm:text-lg lg:text-xl text-[#F7F2E9]/90 font-sans leading-relaxed text-balance">
                      اكتشف جذورك واعرف عمود نسبك – ابنِ شجرة عائلتك – احفظ ووثّق وشارك إرث العائلة.
                    </p>
                  </div>

                  {/* Regional Slogan & Heritage Card ("بشكل مميز") */}
                  <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-2.5 h-full bg-[#D8755B]" />
                    <div className="pr-3 space-y-2.5">
                      <div className="flex items-center justify-between text-xs text-[#F7F2E9]/75">
                        <span>شعار المنصة في {countryInfo.name}</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#D8755B]/40 text-white font-medium text-[11px]">
                          {countryInfo.regionLabel}
                        </span>
                      </div>
                      <p className="text-lg sm:text-xl font-display font-bold text-white leading-snug">
                        «{countryInfo.slogan}»
                      </p>
                      <p className="text-xs sm:text-sm text-[#F7F2E9]/80 leading-relaxed font-sans">
                        {countryInfo.heritageNote}
                      </p>
                    </div>
                  </div>

                  {/* Distinctive Trust Markers & Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                    <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-3.5">
                      <p className="text-xl sm:text-2xl font-display font-bold text-[#D8755B] tabular-nums">+2.27M</p>
                      <p className="text-xs text-[#F7F2E9]/75 mt-0.5">عقدة نسب مفهرسة</p>
                    </div>
                    <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-3.5">
                      <p className="text-xl sm:text-2xl font-display font-bold text-white">مجاني</p>
                      <p className="text-xs text-[#F7F2E9]/75 mt-0.5">البحث الأولي بدون رسوم</p>
                    </div>
                    <div className="col-span-2 sm:col-span-1 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-3.5">
                      <p className="text-xl sm:text-2xl font-display font-bold text-white">22 دولة</p>
                      <p className="text-xs text-[#F7F2E9]/75 mt-0.5">تغطية الوطن العربي</p>
                    </div>
                  </div>
                </div>

                {/* 2. LEFT COLUMN (Second in RTL layout): Sleek Registration & Search Form Card */}
                <div className="lg:col-span-6 rounded-3xl bg-[#F7F2E9]/98 backdrop-blur-md border border-[#B98A78]/50 p-6 sm:p-8 shadow-2xl flex flex-col justify-between text-[#252321]">
                  <div>
                    {/* Step Progress Indicator */}
                    <ol
                      aria-label="مراحل البحث عن الجذور"
                      className="flex items-center justify-between gap-2 pb-3.5 mb-4 border-b border-[#B98A78]/25 text-xs sm:text-sm font-display font-semibold"
                    >
                      <li
                        className={`flex items-center gap-2 whitespace-nowrap ${
                          searchStep >= 1 ? 'text-[#D8755B]' : 'text-[#252321]/50'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs tabular-nums ${
                            searchStep >= 1
                              ? 'bg-[#D8755B] text-white'
                              : 'bg-[#EDE6DA] text-[#252321]/70'
                          }`}
                        >
                          1
                        </span>
                        <span>1. البيانات الأساسية</span>
                      </li>
                      <span className="text-[#B98A78] text-xs" aria-hidden="true">
                        ←
                      </span>
                      <li
                        className={`flex items-center gap-2 whitespace-nowrap ${
                          searchStep >= 2 ? 'text-[#D8755B]' : 'text-[#252321]/55'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs tabular-nums ${
                            searchStep >= 2
                              ? 'bg-[#D8755B] text-white'
                              : 'bg-[#EDE6DA] text-[#252321]/70'
                          }`}
                        >
                          2
                        </span>
                        <span>2. التحقق</span>
                      </li>
                      <span className="text-[#B98A78] text-xs" aria-hidden="true">
                        ←
                      </span>
                      <li
                        className={`flex items-center gap-2 whitespace-nowrap ${
                          searchStep >= 3 ? 'text-[#D8755B]' : 'text-[#252321]/55'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs tabular-nums ${
                            searchStep >= 3
                              ? 'bg-[#D8755B] text-white'
                              : 'bg-[#EDE6DA] text-[#252321]/70'
                          }`}
                        >
                          3
                        </span>
                        <span>3. النتيجة</span>
                      </li>
                    </ol>

                <div className="mb-4">
                  <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#252321] leading-tight">
                    لنبدأ من حيث تعرف
                  </h2>
                  <p className="text-xs sm:text-sm text-[#252321]/75 mt-1.5 leading-relaxed">
                    أدخل بعض البيانات الأساسية عنك، وسنبحث عما وجدناه عن جذورك
                  </p>
                </div>

                <form onSubmit={handleFormSubmit} className="space-y-3.5" noValidate>
                  {/* Account Legal Type Selector */}
                  <fieldset>
                    <legend className="block text-sm font-display font-bold text-[#252321] mb-2.5">
                      الصفة القانونية للحساب *
                    </legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={form.accountType === AccountLegalType.Individual}
                        onClick={() =>
                          handleFieldChange('accountType', AccountLegalType.Individual)
                        }
                        className={`text-right rounded-xl p-3.5 border transition-colors cursor-pointer ${
                          form.accountType === AccountLegalType.Individual
                            ? 'bg-[#F7F2E9] border-[#D8755B] ring-1 ring-[#D8755B]'
                            : 'bg-[#EDE6DA]/45 border-[#B98A78]/40 hover:bg-[#EDE6DA]/80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-display font-bold text-sm text-[#252321]">
                            فرد
                          </span>
                          <span
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              form.accountType === AccountLegalType.Individual
                                ? 'border-[#D8755B]'
                                : 'border-[#B98A78]'
                            }`}
                          >
                            {form.accountType === AccountLegalType.Individual && (
                              <span className="w-2 h-2 rounded-full bg-[#D8755B]" />
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-[#252321]/75 leading-relaxed">
                          استعراض عمود النسب الموثق للعائلة
                        </p>
                      </button>

                      <button
                        type="button"
                        role="radio"
                        aria-checked={form.accountType === AccountLegalType.RecordKeeper}
                        onClick={() =>
                          handleFieldChange('accountType', AccountLegalType.RecordKeeper)
                        }
                        className={`text-right rounded-xl p-3.5 border transition-colors cursor-pointer ${
                          form.accountType === AccountLegalType.RecordKeeper
                            ? 'bg-[#F7F2E9] border-[#D8755B] ring-1 ring-[#D8755B]'
                            : 'bg-[#EDE6DA]/45 border-[#B98A78]/40 hover:bg-[#EDE6DA]/80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-display font-bold text-sm text-[#252321]">
                            رب أسرة (أمين السجل)
                          </span>
                          <span
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              form.accountType === AccountLegalType.RecordKeeper
                                ? 'border-[#D8755B]'
                                : 'border-[#B98A78]'
                            }`}
                          >
                            {form.accountType === AccountLegalType.RecordKeeper && (
                              <span className="w-2 h-2 rounded-full bg-[#D8755B]" />
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-[#252321]/75 leading-relaxed">
                          استعراض عمود النسب وبناء شجرة العائلة
                        </p>
                      </button>
                    </div>

                    {form.accountType === AccountLegalType.RecordKeeper && (
                      <div
                        role="status"
                        className="mt-3 rounded-xl bg-[#EDE6DA] border border-[#D8755B]/45 px-4 py-2.5 flex items-center gap-2.5 text-xs sm:text-sm font-medium text-[#252321]"
                      >
                        <CheckCircle2
                          className="w-4 h-4 text-[#D8755B] shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          بصفتك أمين السجل، تلتزم بميثاق دقة البيانات العائلية المعتمد في منصة جذوري
                        </span>
                      </div>
                    )}
                  </fieldset>

                  {/* Core Visible Inputs (5 Fields) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor="input-first-name"
                        className="block text-sm font-medium text-[#252321] mb-1.5"
                      >
                        الاسم الأول *
                      </label>
                      <input
                        id="input-first-name"
                        type="text"
                        value={form.firstName}
                        onChange={(e) => handleFieldChange('firstName', e.target.value)}
                        placeholder="مثال: حسن"
                        className="w-full rounded-xl bg-[#F7F2E9]/70 border border-[#B98A78]/55 px-3.5 py-2.5 text-sm text-[#252321] placeholder:text-[#252321]/40 focus:outline-none focus:bg-white focus:border-[#D8755B]"
                      />
                      {validationErrors.firstName && (
                        <p className="mt-1 text-xs text-red-700 font-medium">
                          {validationErrors.firstName}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="input-father-name"
                        className="block text-sm font-medium text-[#252321] mb-1.5"
                      >
                        اسم الأب
                      </label>
                      <input
                        id="input-father-name"
                        type="text"
                        value={form.fatherName}
                        onChange={(e) => handleFieldChange('fatherName', e.target.value)}
                        placeholder="مثال: زهير"
                        className="w-full rounded-xl bg-[#F7F2E9]/70 border border-[#B98A78]/55 px-3.5 py-2.5 text-sm text-[#252321] placeholder:text-[#252321]/40 focus:outline-none focus:bg-white focus:border-[#D8755B]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="input-grandfather-name"
                        className="block text-sm font-medium text-[#252321] mb-1.5"
                      >
                        اسم الجد
                      </label>
                      <input
                        id="input-grandfather-name"
                        type="text"
                        value={form.grandfatherName}
                        onChange={(e) =>
                          handleFieldChange('grandfatherName', e.target.value)
                        }
                        placeholder="مثال: حسن"
                        className="w-full rounded-xl bg-[#F7F2E9]/70 border border-[#B98A78]/55 px-3.5 py-2.5 text-sm text-[#252321] placeholder:text-[#252321]/40 focus:outline-none focus:bg-white focus:border-[#D8755B]"
                      />
                    </div>
                  </div>

                  {/* Family Name Input */}
                  <div>
                    <label
                      htmlFor="input-family-name"
                      className="block text-sm font-medium text-[#252321] mb-1.5"
                    >
                      اسم العائلة *
                    </label>
                    <input
                      id="input-family-name"
                      type="text"
                      value={form.familyName}
                      onChange={(e) => handleFieldChange('familyName', e.target.value)}
                      placeholder="مثال: آل مقيت"
                      className="w-full rounded-xl bg-[#F7F2E9]/70 border border-[#B98A78]/55 px-3.5 py-2.5 text-sm text-[#252321] placeholder:text-[#252321]/40 focus:outline-none focus:bg-white focus:border-[#D8755B]"
                    />
                    {validationErrors.familyName && (
                      <p className="mt-1 text-xs text-red-700 font-medium">
                        {validationErrors.familyName}
                      </p>
                    )}
                  </div>

                  {/* الموطن الأصلي */}
                  <div className="space-y-2">
                    <span className="block text-sm font-display font-bold text-[#252321]">
                      الموطن الأصلي
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="input-origin-country"
                          className="block text-xs font-medium text-[#252321] mb-1.5"
                        >
                          الدولة
                        </label>
                        <div className="relative">
                          <select
                            id="input-origin-country"
                            value={form.originCountry}
                            onChange={(e) => {
                              handleFieldChange('originCountry', e.target.value);
                              if (
                                e.target.value &&
                                e.target.value !== 'المهجر (Diaspora)'
                              ) {
                                onSelectPortalCountry(e.target.value);
                              }
                            }}
                            className="w-full appearance-none rounded-xl bg-[#F7F2E9]/70 border border-[#B98A78]/55 pr-3.5 pl-9 py-2.5 text-sm text-[#252321] focus:outline-none focus:bg-white focus:border-[#D8755B] cursor-pointer"
                          >
                            <option value="">اختر الدولة</option>
                            {ORIGIN_COUNTRY_OPTIONS.map((country) => (
                              <option key={country} value={country}>
                                {country}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            className="w-4 h-4 text-[#252321]/65 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                            aria-hidden="true"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="input-origin-region"
                          className="block text-xs font-medium text-[#252321] mb-1.5"
                        >
                          المنطقة أو المدينة
                        </label>
                        <input
                          id="input-origin-region"
                          type="text"
                          value={form.originRegion || ''}
                          onChange={(e) =>
                            handleFieldChange('originRegion', e.target.value)
                          }
                          placeholder="مثال: نجد، الحجاز، دير الزور..."
                          className="w-full rounded-xl bg-[#F7F2E9]/70 border border-[#B98A78]/55 px-3.5 py-2.5 text-sm text-[#252321] placeholder:text-[#252321]/40 focus:outline-none focus:bg-white focus:border-[#D8755B]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Optional Tribe / Branch Accordion */}
                  <div className="rounded-xl border border-[#B98A78]/40 bg-[#EDE6DA]/45 overflow-hidden">
                    <button
                      type="button"
                      aria-expanded={showOptionalTribe}
                      onClick={() => setShowOptionalTribe((prev) => !prev)}
                      className="w-full px-4 py-3 flex items-center justify-between text-right text-sm font-display font-semibold text-[#252321] hover:bg-[#EDE6DA]/80 transition-colors cursor-pointer"
                    >
                      <span>+ أضف بيانات لتحسين جودة البحث (اضغط هنا)</span>
                      {showOptionalTribe ? (
                        <ChevronUp className="w-4 h-4 text-[#D8755B]" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#D8755B]" aria-hidden="true" />
                      )}
                    </button>

                    <AnimatePresence initial={false}>
                      {showOptionalTribe && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.16 }}
                          className="px-4 pb-4 pt-2 border-t border-[#B98A78]/25 grid grid-cols-1 sm:grid-cols-2 gap-4"
                        >
                          <div>
                            <label
                              htmlFor="input-tribe-name"
                              className="block text-xs sm:text-sm font-medium text-[#252321] mb-1.5"
                            >
                              اسم القبيلة (إن وجد - اختياري)
                            </label>
                            <input
                              id="input-tribe-name"
                              type="text"
                              value={form.tribeName}
                              onChange={(e) =>
                                handleFieldChange('tribeName', e.target.value)
                              }
                              placeholder="مثال: بني بشر"
                              className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3.5 py-2 text-sm text-[#252321] placeholder:text-[#252321]/40 focus:outline-none focus:border-[#D8755B]"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="input-branch-name"
                              className="block text-xs sm:text-sm font-medium text-[#252321] mb-1.5"
                            >
                              فرع من القبيلة / الفخذ (اختياري)
                            </label>
                            <input
                              id="input-branch-name"
                              type="text"
                              value={form.branchName}
                              onChange={(e) =>
                                handleFieldChange('branchName', e.target.value)
                              }
                              placeholder="مثال: آل برمان"
                              className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3.5 py-2 text-sm text-[#252321] placeholder:text-[#252321]/40 focus:outline-none focus:border-[#D8755B]"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Step 1 Primary CTA Button (#D8755B) - Zero Friction Onboarding */}

                  {/* Primary CTA Button (#D8755B) */}
                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={isSearching}
                      className="w-full py-3.5 px-6 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] disabled:opacity-70 text-white font-display font-bold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      {isSearching ? (
                        <span>جاري البحث ومطابقة العقد التاريخية في محرك جذوري...</span>
                      ) : (
                        <>
                          <span>ابدأ خطوة البحث الأولى مجاناً ←</span>
                        </>
                      )}
                    </button>
                    <p className="text-center text-xs text-[#252321]/70 mt-2.5">
                      البحث الأولي مجاني. تدفع فقط إذا وجدنا لك نتيجة.
                    </p>
                  </div>
                </form>
                </div>
              </div>

            </div>
          </div>
        </section>
        )}

        {/* C & D. Section 2 & 3: Core Strengths (4 Cards) + The 6 Platform Services (Shown on Home AND on 'what-is-juthori' page) */}
        {(activePublicPage === 'home' || activePublicPage === 'what-is-juthori') && (
          <div className={activePublicPage === 'what-is-juthori' ? 'min-h-[calc(100vh-5rem)]' : ''}>
            {/* C. Section 2: Core Strengths (نقاط القوة - 4 Cards) */}
            <section
              id="what-is-juthori"
              className="border-t border-[#B98A78]/25 bg-[#EDE6DA]/55 py-16 lg:py-20"
            >
              <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold text-[#D8755B] mb-2">
                      ما هو جذوري · ركائز المنصة
                    </p>
                    <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#252321] text-balance">
                      أربع ركائز تفصل بين التوثيق النسبي المحقق والتخمين غير المسند
                    </h2>
                  </div>
                  {activePublicPage === 'what-is-juthori' && (
                    <button
                      type="button"
                      onClick={() => navigatePublicPage('home')}
                      className="self-start md:self-auto px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs sm:text-sm font-display font-bold transition-colors cursor-pointer"
                    >
                      ابدأ فحص نسب عائلتك مجاناً ←
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {CORE_STRENGTHS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <article
                        key={item.number}
                        className="rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/40 p-6 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-5">
                            <span className="text-sm font-mono font-semibold text-[#B98A78] tabular-nums">
                              {item.number}
                            </span>
                            <div className="w-10 h-10 rounded-xl bg-[#EDE6DA] flex items-center justify-center text-[#D8755B]">
                              <Icon className="w-5 h-5" aria-hidden="true" />
                            </div>
                          </div>
                          <h3 className="text-lg font-display font-bold text-[#252321] mb-2.5">
                            {item.title}
                          </h3>
                          <p className="text-sm text-[#252321]/80 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* D. Section 3: The 6 Platform Services (الخدمات الـ 6) */}
            <section className="py-16 lg:py-24 max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold text-[#D8755B] mb-2">
                    منظومة خدمات جذوري المتكاملة
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#252321] text-balance">
                    ستة أعمدة رقمية لحفظ النسب وبناء الشجرة وصون ذاكرة العائلة
                  </h2>
                </div>
                <p className="text-sm text-[#252321]/75 max-w-md">
                  تبدأ رحلتك مجاناً باكتشاف نقطة الربط، وتتوسع نحو منظومة متكاملة لإدارة سجل العائلة وموقعها الخاص.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5 items-stretch">
                {PLATFORM_SERVICES_6.map((service, index) => {
                  const Icon = service.icon;
                  const isHighlighted = index === 0 || index === 1;
                  return (
                    <article
                      key={service.number}
                      className={`rounded-2xl p-6 flex flex-col justify-between border transition-transform duration-150 hover:-translate-y-0.5 ${
                        isHighlighted
                          ? 'bg-[#D8755B] text-white border-[#D8755B]'
                          : 'bg-[#EDE6DA] text-[#252321] border-[#B98A78]/45'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-6">
                          <span
                            className={`text-xs font-mono font-semibold tabular-nums ${
                              isHighlighted ? 'text-white/80' : 'text-[#B98A78]'
                            }`}
                          >
                            {service.number}
                          </span>
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              isHighlighted
                                ? 'bg-white/15 text-white'
                                : 'bg-[#F7F2E9] text-[#D8755B]'
                            }`}
                          >
                            <Icon className="w-5 h-5" aria-hidden="true" />
                          </div>
                        </div>

                        <h3 className="text-lg font-display font-bold leading-snug mb-1.5">
                          {service.title}
                        </h3>
                        <p
                          className={`text-xs font-medium mb-4 ${
                            isHighlighted ? 'text-white/85' : 'text-[#D8755B]'
                          }`}
                        >
                          {service.subtitle}
                        </p>
                        <p
                          className={`text-sm leading-relaxed ${
                            isHighlighted ? 'text-white/95' : 'text-[#252321]/80'
                          }`}
                        >
                          {service.description}
                        </p>
                      </div>

                      <div
                        className={`mt-6 pt-4 border-t text-xs font-medium ${
                          isHighlighted
                            ? 'border-white/20 text-white/90'
                            : 'border-[#B98A78]/30 text-[#252321]/70'
                        }`}
                      >
                        {index === 1 ? 'يتطلب صفة أمين السجل' : 'متاح ضمن منظومة جذوري'}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* E. Section 4: About Us & Knowledge Center (Shown on Home, 'about-us', and 'knowledge-center') */}
        {(activePublicPage === 'home' ||
          activePublicPage === 'about-us' ||
          activePublicPage === 'knowledge-center') && (
          <section
            id="about-us"
            className={`border-t border-[#B98A78]/25 bg-[#EDE6DA]/45 py-16 lg:py-20 ${
              activePublicPage !== 'home' ? 'min-h-[calc(100vh-5rem)]' : ''
            }`}
          >
            <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              {(activePublicPage === 'home' || activePublicPage === 'about-us') && (
                <div
                  className={
                    activePublicPage === 'about-us'
                      ? 'lg:col-span-12 max-w-4xl mx-auto space-y-6'
                      : 'lg:col-span-6 space-y-4'
                  }
                >
                  <p className="text-xs font-semibold text-[#D8755B]">
                    من نحن · منهجية الفهرسة والتحقيق
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#252321] text-balance">
                    مشروع عربي يجمع تحقيق المخطوطات التراثية وهندسة قواعد البيانات العلائقية
                  </h2>
                  <p className="text-sm sm:text-base text-[#252321]/80 leading-relaxed">
                    تأسست منصة «جذوري» لسد الفجوة بين أمهات كتب الأنساب العربية والمشجرات العائلية الموثقة وبين الأجيال المعاصرة في 22 دولة عربية والمهجر، وفق ضوابط شرعية وقانونية تحفظ خصوصية الأسر وتمنح أمين السجل صلاحية التوثيق المعتمد.
                  </p>
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#B98A78]/30">
                    <div>
                      <div className="text-2xl font-display font-bold text-[#252321] tabular-nums">
                        +2.27M
                      </div>
                      <div className="text-xs text-[#252321]/70 mt-0.5">
                        عقدة نسب مهيكلة
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-display font-bold text-[#252321] tabular-nums">
                        22
                      </div>
                      <div className="text-xs text-[#252321]/70 mt-0.5">
                        دولة عربية + المهجر
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-display font-bold text-[#252321] tabular-nums">
                        $0
                      </div>
                      <div className="text-xs text-[#252321]/70 mt-0.5">
                        رسوم الفحص الأولي
                      </div>
                    </div>
                  </div>
                  {activePublicPage === 'about-us' && (
                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={() => navigatePublicPage('home')}
                        className="px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-sm font-display font-bold transition-colors cursor-pointer"
                      >
                        ابدأ البحث في سجل عائلتك ←
                      </button>
                    </div>
                  )}
                </div>
              )}

              {(activePublicPage === 'home' || activePublicPage === 'knowledge-center') && (
                <div
                  id="knowledge-center"
                  className={
                    activePublicPage === 'knowledge-center'
                      ? 'lg:col-span-12 space-y-8'
                      : 'lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-5'
                  }
                >
                  {activePublicPage === 'knowledge-center' && (
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#B98A78]/30 pb-6">
                      <div>
                        <p className="text-xs font-semibold text-[#D8755B] mb-2">
                          المركز المعرفي · دراسات الأنساب وتحقيق المخطوطات
                        </p>
                        <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#252321]">
                          المرجع العلمي لطبقات الأنساب العربية وتوثيق المشجرات
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigatePublicPage('home')}
                        className="self-start md:self-auto px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs sm:text-sm font-display font-bold transition-colors cursor-pointer"
                      >
                        العودة للرئيسية وفحص النسب ←
                      </button>
                    </div>
                  )}

                  <div
                    className={
                      activePublicPage === 'knowledge-center'
                        ? 'grid grid-cols-1 sm:grid-cols-2 gap-6'
                        : 'contents'
                    }
                  >
                    <div className="rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/40 overflow-hidden flex flex-col">
                      <div className="aspect-[16/10] overflow-hidden">
                        <ResilientImage
                          src={JUTHORI_MEDIA.manuscriptScroll}
                          alt="المركز المعرفي — تحقيق المخطوطات والمشجرات"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-5">
                        <p className="text-xs text-[#D8755B] font-semibold mb-1">
                          المركز المعرفي · تحقيق المصادر
                        </p>
                        <h3 className="text-base font-display font-bold text-[#252321] mb-1.5">
                          مراتب الطبقات والربط الثلاثي بالجذر
                        </h3>
                        <p className="text-xs text-[#252321]/75 leading-relaxed">
                          كيف نطابق العقدة العائلية (FE0) بالفرع القبلي الموثق (الجذر - B2) والقبيلة الأم الموثقة (B0) صعوداً إلى الجذوم الكبرى في جمهرة أنساب العرب والإكليل.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/40 overflow-hidden flex flex-col">
                      <div className="aspect-[16/10] overflow-hidden">
                        <ResilientImage
                          src={JUTHORI_MEDIA.memoryVault}
                          alt="خزانة الذاكرة — صون الوثائق والصور العائلية"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-5">
                        <p className="text-xs text-[#D8755B] font-semibold mb-1">
                          المركز المعرفي · ميثاق أمين السجل
                        </p>
                        <h3 className="text-base font-display font-bold text-[#252321] mb-1.5">
                          الفرق بين حساب الفرد وأمين السجل
                        </h3>
                        <p className="text-xs text-[#252321]/75 leading-relaxed">
                          ضماناً لعدم تعدد الروايات غير الموثقة، يُسند بناء شجرة العائلة إلى رب الأسرة الموقع على ميثاق دقة البيانات العائلية.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* F. Support & Contact Center (#support-center) — Shown on Home AND on 'support-center' */}
        {(activePublicPage === 'home' || activePublicPage === 'support-center') && (
          <section
            id="support-center"
            className={`py-16 lg:py-20 max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 ${
              activePublicPage === 'support-center' ? 'min-h-[calc(100vh-5rem)]' : ''
            }`}
          >
            <div className="rounded-2xl bg-[#EDE6DA] border border-[#B98A78]/45 p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-5 space-y-3">
                <p className="text-xs font-semibold text-[#D8755B]">
                  مركز التواصل والدعم
                </p>
                <h2 className="text-2xl font-display font-bold text-[#252321]">
                  هل لديك مشجرة عائلية محققة أو استفسار نسبي؟
                </h2>
                <p className="text-sm text-[#252321]/80 leading-relaxed">
                  يستقبل فريق التحقيق والأرشفة في منصة جذوري طلبات توثيق المشجرات الأسرية واستفسارات أمناء السجل في جميع الدول العربية.
                </p>
                <div className="pt-2 text-xs text-[#252321]/75 space-y-1">
                  <p>البريد الرسمي: support@juthori.com</p>
                  <p>ساعات عمل لجنة التحقيق: الأحد – الخميس (9:00 ص – 6:00 م بتوقيت مكة المكرمة)</p>
                </div>
              </div>

              <div className="lg:col-span-7">
                {supportSent ? (
                  <div className="rounded-xl bg-[#F7F2E9] border border-[#D8755B]/45 p-6 text-right">
                    <h3 className="text-base font-display font-bold text-[#D8755B] mb-1">
                      تم استلام رسالتك بنجاح في مركز التواصل والدعم
                    </h3>
                    <p className="text-sm text-[#252321]/80 mb-4">
                      سيتواصل معك فريق التحقيق وخدمة العملاء عبر بريدك الإلكتروني خلال 24 ساعة عمل.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSupportSent(false)}
                      className="px-4 py-2 rounded-xl bg-[#252321] text-white text-xs font-semibold cursor-pointer"
                    >
                      إرسال رسالة أخرى
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSupportSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4" noValidate>
                    <div>
                      <label
                        htmlFor="support-name"
                        className="block text-xs font-medium text-[#252321] mb-1"
                      >
                        الاسم الكامل
                      </label>
                      <input
                        id="support-name"
                        type="text"
                        value={supportName}
                        onChange={(e) => setSupportName(e.target.value)}
                        placeholder="الاسم الثلاثي"
                        className="w-full rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 px-3.5 py-2.5 text-sm text-[#252321]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="support-email"
                        className="block text-xs font-medium text-[#252321] mb-1"
                      >
                        البريد الإلكتروني
                      </label>
                      <input
                        id="support-email"
                        type="email"
                        dir="ltr"
                        value={supportEmail}
                        onChange={(e) => setSupportEmail(e.target.value)}
                        placeholder="you@domain.com"
                        className="w-full rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 px-3.5 py-2.5 text-right text-sm text-[#252321]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="support-message"
                        className="block text-xs font-medium text-[#252321] mb-1"
                      >
                        موضوع الطلب أو اسم المشجرة
                      </label>
                      <textarea
                        id="support-message"
                        rows={3}
                        value={supportMessage}
                        onChange={(e) => setSupportMessage(e.target.value)}
                        placeholder="اكتب استفسارك أو نبذة عن الوثائق المتوفرة لدى عائلتك..."
                        className="w-full rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 px-3.5 py-2.5 text-sm text-[#252321]"
                      />
                    </div>
                    {supportError && (
                      <p className="sm:col-span-2 text-xs text-red-700 font-medium">
                        {supportError}
                      </p>
                    )}
                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-sm font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Send className="w-4 h-4" aria-hidden="true" />
                        <span>إرسال إلى مركز الدعم</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#B98A78]/30 bg-[#EDE6DA]/70 py-12">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center space-y-3.5">
            <JuthoriLogo
              size="sm"
              onClick={() => {
                setActivePublicPage('home');
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
              }}
            />

            <p className="text-sm sm:text-base font-display font-bold text-[#252321] pt-1">
              ما لا يُوثق اليوم… قد يصبح مجرد رواية غامضة غدًا.
            </p>

            <p className="text-xs sm:text-sm text-[#252321]/80 leading-relaxed font-sans">
              تعمل المنصة من خلال شركة جينيا لاب - الولايات المتحدة الأمريكية.
            </p>

            <p className="text-xs sm:text-sm text-[#252321]/75 font-sans" dir="rtl">
              منصة الأنساب والإرث العائلي العربي — juthori.com
            </p>

            <p className="text-xs text-[#252321]/70 font-sans" dir="rtl">
              جميع الحقوق محفوظة. جذوري © 2026
            </p>

            {onOpenStaffPortal && (
              <div className="pt-3 border-t border-[#B98A78]/25 w-full max-w-md flex justify-center">
                <button
                  type="button"
                  onClick={onOpenStaffPortal}
                  className="px-4 py-2 rounded-xl bg-[#F7F2E9] hover:bg-[#252321] text-[#252321] hover:text-[#F7F2E9] border border-[#B98A78]/50 text-xs font-display font-bold transition-colors cursor-pointer shadow-2xs"
                >
                  🔒 بوابة الإدارة والعمليات (Staff Portal)
                </button>
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};