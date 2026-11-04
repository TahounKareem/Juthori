import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Database,
  Globe,
  Languages,
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
  RefreshCw,
  FileText,
} from 'lucide-react';
import { JuthoriLogo } from './JuthoriLogo';
import { ResilientImage } from './ResilientImage';
import { KnowledgeCenterView } from './KnowledgeCenterView';
import { SupportAndHelpCenterView } from './SupportAndHelpCenterView';
import { JUTHORI_MEDIA } from '../assets/media';
import {
  ORIGIN_COUNTRY_OPTIONS,
  PORTAL_COUNTRY_SWITCHER_OPTIONS,
  getCountryInfoByName,
} from '../data/arabCountries';
import {
  RegistrationFormState,
  SilentGeoMetadata,
} from '../types/juthori';
import {
  validateStep1LineageForm,
} from '../utils/lineageEngine';
import {
  createSupportTicketInFirebase,
  fetchKnowledgeArticlesFromFirebase,
  KnowledgeArticleRecord,
} from '../services/firestoreService';

interface LandingPageProps {
  form: RegistrationFormState;
  onChangeForm: React.Dispatch<React.SetStateAction<RegistrationFormState>>;
  selectedPortalCountry: string;
  onSelectPortalCountry: (countryName: string) => void;
  onSubmitSearch: () => Promise<void>;
  isSearching: boolean;
  searchStep: 1 | 2 | 3;
  onOpenLogin: () => void;
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

const SITE_LANGUAGE_OPTIONS: Array<{
  code: string;
  label: string;
  enabled: boolean;
}> = [
  { code: 'ar', label: 'العربية', enabled: true },
  { code: 'en', label: 'الانجليزية', enabled: false },
  { code: 'fr', label: 'الفرنسية', enabled: false },
  { code: 'es', label: 'الأسبانية', enabled: false },
  { code: 'ur', label: 'الأردو', enabled: false },
  { code: 'tr', label: 'التركية', enabled: false },
  { code: 'fa', label: 'الفارسية', enabled: false },
];

const HERO_BULLET_POINTS = [
  'اكتشف جذورك واعرف عمود نسبك الموثق',
  'ابنِ شجرة عائلتك التفاعلية بسهولة',
  'احفظ ووثّق وشارك إرث العائلة عبر الأجيال',
];

const HERO_VALUE_CARDS = [
  {
    title: 'بناء الشجرة',
    description: 'تكوين وتفرع شجرة العائلة',
    icon: GitBranch,
  },
  {
    title: 'استمرارية الأجيال',
    description: 'إرث حي يتوارثه الأبناء والأحفاد',
    icon: RefreshCw,
  },
  {
    title: 'تحديث البيانات النسبية',
    description: 'إثراء وتوثيق مستمر للمصادر',
    icon: FileText,
  },
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
}) => {
  const [activePublicPage, setActivePublicPage] = useState<PublicPageId>('home');
  const [showOptionalTribe, setShowOptionalTribe] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Partial<Record<keyof RegistrationFormState, string>>
  >({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const [publishedArticles, setPublishedArticles] = useState<KnowledgeArticleRecord[]>([]);

  // Support form state
  const [supportName, setSupportName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSent, setSupportSent] = useState(false);
  const [supportError, setSupportError] = useState('');

  useEffect(() => {
    const loadPublished = () => {
      fetchKnowledgeArticlesFromFirebase(true)
        .then((articles) => {
          setPublishedArticles(articles);
        })
        .catch(() => {});
    };
    loadPublished();
    if (typeof window !== 'undefined') {
      window.addEventListener('juthori-knowledge-articles-updated', loadPublished);
      return () => {
        window.removeEventListener(
          'juthori-knowledge-articles-updated',
          loadPublished
        );
      };
    }
  }, [activePublicPage]);

  useEffect(() => {
    if (!languageMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        languageMenuRef.current &&
        !languageMenuRef.current.contains(e.target as Node)
      ) {
        setLanguageMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLanguageMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [languageMenuOpen]);

  const countryInfo = getCountryInfoByName(selectedPortalCountry);

  const navigatePublicPage = (pageId: PublicPageId) => {
    setActivePublicPage(pageId);
    setMobileMenuOpen(false);
    setLanguageMenuOpen(false);
    if (
      pageId === 'knowledge-center' ||
      pageId === 'support-center' ||
      pageId === 'home'
    ) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setTimeout(() => {
      const el = document.getElementById(pageId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 40);
  };

  const handleFieldChange = <K extends keyof RegistrationFormState>(
    key: K,
    value: RegistrationFormState[K]
  ) => {
    onChangeForm((prev) => ({ ...prev, [key]: value }));
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      if (key === 'originCountry' || key === 'originRegion') {
        delete next.originCountry;
        delete next.originRegion;
      }
      return next;
    });
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

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportName.trim() || !supportEmail.trim() || !supportMessage.trim()) {
      setSupportError('يرجى تعبئة الاسم والبريد الإلكتروني وتفاصيل الاستفسار.');
      return;
    }
    setSupportError('');
    await createSupportTicketInFirebase({
      clientName: supportName.trim(),
      email: supportEmail.trim(),
      category: 'استفسار نسبي',
      subject: supportMessage.trim(),
    }).catch(() => {});
    setSupportSent(true);
    setSupportName('');
    setSupportEmail('');
    setSupportMessage('');
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F7F2E9] text-[#252321] flex flex-col justify-between overflow-x-hidden">
      {/* A. Top Navigation Bar (Mobile-First + Desktop 3-Zone Contract) */}
      <header className="sticky top-0 z-40 bg-[#F7F2E9]/95 backdrop-blur-xs border-b border-[#B98A78]/30">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3 sm:gap-6">
          {/* Right Zone: Juthori Logo */}
          <JuthoriLogo
            size="md"
            onClick={() => navigatePublicPage('home')}
          />

          {/* Center Zone: 5 Full-Page Exclusive Navigation Tabs (Desktop) */}
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

          {/* Left Zone: Compact Country Switcher (Visible on Mobile & Desktop) + Login Button / Hamburger Drawer */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="relative">
              <label htmlFor="portal-country-switcher" className="sr-only">
                اختر الدولة العربية
              </label>
              <select
                id="portal-country-switcher"
                aria-label="بوابة الدول العربية"
                value={selectedPortalCountry}
                onChange={(e) => {
                  const nextCountry = e.target.value;
                  onSelectPortalCountry(nextCountry);
                  handleFieldChange('originCountry', nextCountry);
                }}
                className="appearance-none rounded-xl bg-[#EDE6DA] border border-[#B98A78]/50 pr-2.5 sm:pr-3.5 pl-7 sm:pl-8 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-[#252321] max-w-[135px] sm:max-w-[210px] truncate focus:outline-none focus:border-[#D8755B] cursor-pointer"
              >
                {PORTAL_COUNTRY_SWITCHER_OPTIONS.map((country) => (
                  <option key={country.code} value={country.name}>
                    {country.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#252321]/70 pointer-events-none absolute left-2 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
            </div>

            {/* Language Switcher Dropdown (Between Country Switcher and Login Button) */}
            <div className="relative" ref={languageMenuRef}>
              <button
                type="button"
                onClick={() => setLanguageMenuOpen((v) => !v)}
                aria-label="اختيار لغة الموقع"
                aria-expanded={languageMenuOpen}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#EDE6DA] hover:bg-[#e3dacb] border border-[#B98A78]/50 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-display font-bold text-[#252321] transition-colors cursor-pointer shadow-2xs"
              >
                <Languages
                  className="w-4 h-4 text-[#D8755B] shrink-0"
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">العربية</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#252321]/70 transition-transform ${
                    languageMenuOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              <AnimatePresence>
                {languageMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 mt-2 w-48 rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/55 shadow-2xl py-2 z-50"
                    role="menu"
                    aria-label="قائمة لغات الموقع"
                  >
                    <div className="px-3.5 py-1.5 border-b border-[#B98A78]/25 text-[11px] font-display font-bold text-[#8D4925]">
                      لغة الموقع
                    </div>
                    <div className="py-1">
                      {SITE_LANGUAGE_OPTIONS.map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          disabled={!lang.enabled}
                          onClick={() => {
                            if (lang.enabled) {
                              setLanguageMenuOpen(false);
                            }
                          }}
                          className={`w-full px-3.5 py-2 text-right text-xs font-display flex items-center justify-between transition-colors ${
                            lang.enabled
                              ? 'bg-[#D8755B]/15 text-[#252321] font-extrabold cursor-pointer'
                              : 'text-[#252321]/40 cursor-not-allowed'
                          }`}
                        >
                          <span>{lang.label}</span>
                          {lang.enabled ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#D8755B]" />
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EDE6DA] text-[#252321]/45 font-normal">
                              قريباً
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={onOpenLogin}
              className="hidden lg:inline-flex px-4 py-2 rounded-xl bg-[#252321] hover:bg-[#3a3734] text-[#F7F2E9] text-xs sm:text-sm font-display font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              تسجيل الدخول
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden w-10 h-10 rounded-xl bg-[#EDE6DA] border border-[#B98A78]/40 flex items-center justify-center text-[#252321] cursor-pointer shrink-0"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Smooth Slide-over Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 top-16 sm:top-20 z-40 bg-[#181512]/50 backdrop-blur-xs lg:hidden"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 260 }}
                aria-label="القائمة الجانبية للجوال"
                className="fixed top-16 sm:top-20 left-0 bottom-0 z-50 w-[82vw] max-w-[320px] bg-[#F7F2E9] border-r border-[#B98A78]/40 shadow-2xl p-5 flex flex-col justify-between lg:hidden overflow-y-auto"
              >
                <div className="space-y-4">
                  <div className="pb-3 border-b border-[#B98A78]/25 flex items-center justify-between">
                    <span className="text-xs font-display font-bold text-[#8D4925]">
                      تصفح بوابة جذوري
                    </span>
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-1.5 rounded-lg hover:bg-[#EDE6DA] text-[#252321] cursor-pointer"
                      aria-label="إغلاق القائمة"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <nav className="flex flex-col gap-1.5 text-sm font-display font-bold">
                    {PUBLIC_NAV_ITEMS.map((item) => {
                      const isActive = activePublicPage === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => navigatePublicPage(item.id)}
                          className={`py-3 px-4 rounded-xl text-right transition-colors cursor-pointer flex items-center justify-between ${
                            isActive
                              ? 'bg-[#D8755B] text-white shadow-xs'
                              : 'text-[#252321] hover:bg-[#EDE6DA]'
                          }`}
                        >
                          <span>{item.label}</span>
                          <ArrowLeft className="w-4 h-4 opacity-70" />
                        </button>
                      );
                    })}
                  </nav>

                  <div className="pt-3 border-t border-[#B98A78]/25 space-y-1.5">
                    <label
                      htmlFor="mobile-country-switcher"
                      className="block text-xs font-bold text-[#252321]/80"
                    >
                      تخصيص الدولة والشعار المحلي:
                    </label>
                    <select
                      id="mobile-country-switcher"
                      value={selectedPortalCountry}
                      onChange={(e) => {
                        onSelectPortalCountry(e.target.value);
                        handleFieldChange('originCountry', e.target.value);
                      }}
                      className="w-full rounded-xl bg-[#EDE6DA] border border-[#B98A78]/50 px-3 py-2.5 text-sm font-semibold text-[#252321]"
                    >
                      {PORTAL_COUNTRY_SWITCHER_OPTIONS.map((c) => (
                        <option key={c.code} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#B98A78]/30">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenLogin();
                    }}
                    className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-[#252321] hover:bg-[#3a3734] text-[#F7F2E9] text-sm font-display font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
                  >
                    <span>تسجيل الدخول</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1">
        {activePublicPage === 'knowledge-center' ? (
          <section
            id="knowledge-center"
            className="py-10 sm:py-14 max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8"
          >
            <KnowledgeCenterView
              articles={publishedArticles}
              onBackHome={() => navigatePublicPage('home')}
            />
          </section>
        ) : activePublicPage === 'support-center' ? (
          <section
            id="support-center-page"
            className="py-8 sm:py-12 max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8"
          >
            <SupportAndHelpCenterView
              onBackHome={() => navigatePublicPage('home')}
              onOpenKnowledgeCenter={() => navigatePublicPage('knowledge-center')}
            />
          </section>
        ) : (
          <>
            <section
              id="hero-portal"
              className="scroll-mt-20 relative w-full overflow-hidden min-h-[680px] lg:min-h-[760px] flex items-center py-8 sm:py-12 lg:py-14"
            >
            {/* Dynamic Country Architectural Heritage Image Background */}
            <div className="absolute inset-0 z-0">
              <ResilientImage
                key={countryInfo.heroImageUrl}
                src={countryInfo.heroImageUrl || JUTHORI_MEDIA.heritageCourtyard}
                alt={`التراث المعماري الأصيل — ${countryInfo.name}`}
                className="w-full h-full object-cover object-center transition-all duration-700"
              />
              {/* Balanced Transparent Gradient Scrim showcasing background photography */}
              <div className="absolute inset-0 bg-gradient-to-l from-[#181512]/75 via-[#181512]/50 to-[#181512]/25" />
            </div>

            {/* Hero Foreground Content */}
            <div className="relative z-10 max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-6 sm:gap-8 lg:gap-10">
                {/* 1. RIGHT COLUMN (First in RTL, Top on Mobile): Headline, Bullet Points, Local Slogan & 3 Value Cards */}
                <div className="lg:col-span-7 flex flex-col justify-center text-white space-y-5">
                  {/* 1) Top Fixed Badge */}
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-xs sm:text-sm font-display font-bold text-[#F7F2E9] w-fit shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-[#D8755B]" />
                    <span>بوابة الأنساب العربية الموثقة</span>
                  </div>

                  {/* 2) Major Display Headline + 3 Golden Diamond Bullet Points */}
                  <div className="space-y-3.5">
                    <h1 className="text-2xl sm:text-4xl lg:text-5xl font-display font-extrabold text-white leading-[1.22] tracking-tight drop-shadow-sm">
                      هل تعرف جذورك؟{' '}
                      <span className="text-[#F3D299] sm:block mt-1">
                        قصتك لم تبدأ بك.
                      </span>
                    </h1>

                    <ul className="space-y-2 pt-1">
                      {HERO_BULLET_POINTS.map((point) => (
                        <li
                          key={point}
                          className="flex items-center gap-2.5 text-sm sm:text-base lg:text-lg font-display font-bold text-[#F7F2E9] drop-shadow-xs"
                        >
                          <span
                            className="text-[#F3D299] text-sm sm:text-base shrink-0"
                            aria-hidden="true"
                          >
                            ✦
                          </span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 3) Country Local Dialect Slogan Card (Without any "شعار المنصة في..." header) */}
                  <div className="rounded-2xl bg-[#181512]/55 backdrop-blur-md border border-white/20 p-4 sm:p-5 text-white shadow-xl relative overflow-hidden max-w-2xl">
                    <div className="absolute top-0 right-0 w-2 h-full bg-[#D8755B]" />
                    <div className="pr-3 space-y-1.5">
                      <p className="text-base sm:text-xl font-display font-extrabold text-[#F3D299] leading-snug">
                        «{countryInfo.slogan}»
                      </p>
                      <p className="text-xs sm:text-sm text-[#F7F2E9]/90 leading-relaxed font-sans">
                        {countryInfo.heritageNote}
                      </p>
                    </div>
                  </div>

                  {/* 4) 3 Glassmorphic Value & Continuity Cards (Replacing old stats boxes) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-1 max-w-2xl">
                    {HERO_VALUE_CARDS.map((card) => {
                      const Icon = card.icon;
                      return (
                        <div
                          key={card.title}
                          className="rounded-xl backdrop-blur-md bg-white/10 border border-white/15 p-3 sm:p-3.5 flex items-start gap-2.5 shadow-sm"
                        >
                          <div className="w-8 h-8 rounded-lg bg-[#D8755B]/30 border border-[#F3D299]/30 flex items-center justify-center text-[#F3D299] shrink-0 mt-0.5">
                            <Icon className="w-4 h-4" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-display font-bold text-white leading-tight">
                              {card.title}
                            </p>
                            <p className="text-[11px] text-[#F7F2E9]/80 mt-0.5 leading-snug">
                              {card.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. LEFT COLUMN (Second in RTL, Directly Below on Mobile): Ultra-Compact Search Form Card */}
                <div className="lg:col-span-5 flex justify-center lg:justify-end w-full">
                  <div className="w-full max-w-full md:max-w-[380px] rounded-2xl bg-[#F7F2E9]/96 backdrop-blur-md border border-[#B98A78]/55 p-4 sm:p-5 shadow-2xl text-[#252321]">
                    {/* Compact Step Progress Indicator */}
                    <ol
                      aria-label="مراحل البحث عن الجذور"
                      className="flex items-center justify-between gap-1.5 pb-2.5 mb-3 border-b border-[#B98A78]/25 text-[11px] font-display font-bold"
                    >
                      <li
                        className={`flex items-center gap-1.5 whitespace-nowrap ${
                          searchStep >= 1 ? 'text-[#D8755B]' : 'text-[#252321]/50'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] tabular-nums ${
                            searchStep >= 1
                              ? 'bg-[#D8755B] text-white'
                              : 'bg-[#EDE6DA] text-[#252321]/70'
                          }`}
                        >
                          1
                        </span>
                        <span>البيانات</span>
                      </li>
                      <span className="text-[#B98A78] text-[10px]" aria-hidden="true">
                        ←
                      </span>
                      <li
                        className={`flex items-center gap-1.5 whitespace-nowrap ${
                          searchStep >= 2 ? 'text-[#D8755B]' : 'text-[#252321]/55'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] tabular-nums ${
                            searchStep >= 2
                              ? 'bg-[#D8755B] text-white'
                              : 'bg-[#EDE6DA] text-[#252321]/70'
                          }`}
                        >
                          2
                        </span>
                        <span>التحقق</span>
                      </li>
                      <span className="text-[#B98A78] text-[10px]" aria-hidden="true">
                        ←
                      </span>
                      <li
                        className={`flex items-center gap-1.5 whitespace-nowrap ${
                          searchStep >= 3 ? 'text-[#D8755B]' : 'text-[#252321]/55'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] tabular-nums ${
                            searchStep >= 3
                              ? 'bg-[#D8755B] text-white'
                              : 'bg-[#EDE6DA] text-[#252321]/70'
                          }`}
                        >
                          3
                        </span>
                        <span>النتيجة</span>
                      </li>
                    </ol>

                    <div className="mb-3">
                      <h2 className="text-lg sm:text-xl font-display font-extrabold text-[#252321] leading-tight">
                        لنبدأ من حيث تعرف
                      </h2>
                      <p className="text-xs text-[#252321]/75 mt-0.5 leading-snug">
                        أدخل بياناتك الأساسية للبحث في السجلات التاريخية الموثقة
                      </p>
                    </div>

                    <form onSubmit={handleFormSubmit} className="space-y-2.5" noValidate>
                      {/* Row 1: (الاسم الأول * | اسم الأب | اسم الجد) in 1 compact 3-column row */}
                      <div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label
                              htmlFor="input-first-name"
                              className="block text-[11px] font-bold text-[#252321] mb-1 truncate"
                            >
                              الاسم الأول *
                            </label>
                            <input
                              id="input-first-name"
                              type="text"
                              value={form.firstName}
                              onChange={(e) =>
                                handleFieldChange('firstName', e.target.value)
                              }
                              placeholder="حسن"
                              className="w-full h-9 rounded-xl bg-white/85 border border-[#B98A78]/55 px-2.5 text-sm text-[#252321] placeholder:text-[#252321]/35 focus:outline-none focus:bg-white focus:border-[#D8755B]"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="input-father-name"
                              className="block text-[11px] font-bold text-[#252321] mb-1 truncate"
                            >
                              اسم الأب
                            </label>
                            <input
                              id="input-father-name"
                              type="text"
                              value={form.fatherName}
                              onChange={(e) =>
                                handleFieldChange('fatherName', e.target.value)
                              }
                              placeholder="زهير"
                              className="w-full h-9 rounded-xl bg-white/85 border border-[#B98A78]/55 px-2.5 text-sm text-[#252321] placeholder:text-[#252321]/35 focus:outline-none focus:bg-white focus:border-[#D8755B]"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="input-grandfather-name"
                              className="block text-[11px] font-bold text-[#252321] mb-1 truncate"
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
                              placeholder="حسن"
                              className="w-full h-9 rounded-xl bg-white/85 border border-[#B98A78]/55 px-2.5 text-sm text-[#252321] placeholder:text-[#252321]/35 focus:outline-none focus:bg-white focus:border-[#D8755B]"
                            />
                          </div>
                        </div>
                        {validationErrors.firstName && (
                          <p className="mt-1 text-[11px] text-red-700 font-medium">
                            {validationErrors.firstName}
                          </p>
                        )}
                      </div>

                      {/* Row 2: (اسم العائلة * | الدولة) in 1 compact 2-column row */}
                      <div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label
                              htmlFor="input-family-name"
                              className="block text-[11px] font-bold text-[#252321] mb-1 truncate"
                            >
                              اسم العائلة *
                            </label>
                            <input
                              id="input-family-name"
                              type="text"
                              value={form.familyName}
                              onChange={(e) =>
                                handleFieldChange('familyName', e.target.value)
                              }
                              placeholder="مثال: آل مقيت"
                              className="w-full h-9 rounded-xl bg-white/85 border border-[#B98A78]/55 px-2.5 text-sm text-[#252321] placeholder:text-[#252321]/35 focus:outline-none focus:bg-white focus:border-[#D8755B]"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="input-origin-country"
                              className="block text-[11px] font-bold text-[#252321] mb-1 truncate"
                            >
                              الدولة
                            </label>
                            <div className="relative">
                              <select
                                id="input-origin-country"
                                value={form.originCountry}
                                onChange={(e) => {
                                  handleFieldChange('originCountry', e.target.value);
                                  if (e.target.value) {
                                    onSelectPortalCountry(e.target.value);
                                  }
                                }}
                                className="w-full h-9 appearance-none rounded-xl bg-white/85 border border-[#B98A78]/55 pr-2.5 pl-7 text-xs sm:text-sm text-[#252321] focus:outline-none focus:bg-white focus:border-[#D8755B] cursor-pointer"
                              >
                                <option value="">اختر الدولة</option>
                                {ORIGIN_COUNTRY_OPTIONS.map((country) => (
                                  <option key={country} value={country}>
                                    {country}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown
                                className="w-3.5 h-3.5 text-[#252321]/65 pointer-events-none absolute left-2 top-1/2 -translate-y-1/2"
                                aria-hidden="true"
                              />
                            </div>
                          </div>
                        </div>
                        {validationErrors.familyName && (
                          <p className="mt-1 text-[11px] text-red-700 font-medium">
                            {validationErrors.familyName}
                          </p>
                        )}
                      </div>

                      {/* Row 3: (الموطن الأصلي) */}
                      <div>
                        <label
                          htmlFor="input-origin-region"
                          className="block text-[11px] font-bold text-[#252321] mb-1"
                        >
                          الموطن الأصلي
                        </label>
                        <input
                          id="input-origin-region"
                          type="text"
                          value={form.originRegion || ''}
                          onChange={(e) =>
                            handleFieldChange('originRegion', e.target.value)
                          }
                          placeholder="مثال: نجد، الحجاز، دير الزور..."
                          className="w-full h-9 rounded-xl bg-white/85 border border-[#B98A78]/55 px-2.5 text-sm text-[#252321] placeholder:text-[#252321]/35 focus:outline-none focus:bg-white focus:border-[#D8755B]"
                        />
                        {(validationErrors.originRegion || validationErrors.originCountry) && (
                          <p className="mt-1.5 rounded-lg bg-[#FAF3EA] border border-[#D8755B]/45 px-2.5 py-1.5 text-[11px] text-[#8D4925] font-bold leading-snug">
                            {validationErrors.originRegion || validationErrors.originCountry}
                          </p>
                        )}
                      </div>

                      {/* Row 4: Compact Expandable Toggle "+ بيانات إضافية" */}
                      <div className="rounded-xl border border-[#B98A78]/40 bg-[#EDE6DA]/50 overflow-hidden">
                        <button
                          type="button"
                          aria-expanded={showOptionalTribe}
                          onClick={() => setShowOptionalTribe((prev) => !prev)}
                          className="w-full px-3 py-2 flex items-center justify-between text-right text-xs font-display font-bold text-[#252321] hover:bg-[#EDE6DA]/90 transition-colors cursor-pointer"
                        >
                          <span>+ بيانات إضافية</span>
                          {showOptionalTribe ? (
                            <ChevronUp className="w-3.5 h-3.5 text-[#D8755B]" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-[#D8755B]" aria-hidden="true" />
                          )}
                        </button>

                        <AnimatePresence initial={false}>
                          {showOptionalTribe && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.15 }}
                              className="px-3 pb-3 pt-2 border-t border-[#B98A78]/25 grid grid-cols-2 gap-2"
                            >
                              <div>
                                <label
                                  htmlFor="input-tribe-name"
                                  className="block text-[11px] font-bold text-[#252321] mb-1 truncate"
                                >
                                  القبيلة
                                </label>
                                <input
                                  id="input-tribe-name"
                                  type="text"
                                  value={form.tribeName}
                                  onChange={(e) =>
                                    handleFieldChange('tribeName', e.target.value)
                                  }
                                  placeholder="مثال: بني بشر"
                                  className="w-full h-9 rounded-lg bg-white border border-[#B98A78]/50 px-2.5 text-sm text-[#252321] placeholder:text-[#252321]/35 focus:outline-none focus:border-[#D8755B]"
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor="input-branch-name"
                                  className="block text-[11px] font-bold text-[#252321] mb-1 truncate"
                                >
                                  الفرع / الفخذ
                                </label>
                                <input
                                  id="input-branch-name"
                                  type="text"
                                  value={form.branchName}
                                  onChange={(e) =>
                                    handleFieldChange('branchName', e.target.value)
                                  }
                                  placeholder="مثال: آل برمان"
                                  className="w-full h-9 rounded-lg bg-white border border-[#B98A78]/50 px-2.5 text-sm text-[#252321] placeholder:text-[#252321]/35 focus:outline-none focus:border-[#D8755B]"
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Row 5: Sleek Submit CTA Button */}
                      <div className="pt-1">
                        <button
                          type="submit"
                          disabled={isSearching}
                          className="w-full min-h-[42px] py-2.5 px-4 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] disabled:opacity-70 text-white font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
                        >
                          {isSearching ? (
                            <span>جاري البحث في السجلات التاريخية...</span>
                          ) : (
                            <span>ابدأ خطوة البحث الأولى مجاناً ←</span>
                          )}
                        </button>
                        <p className="text-center text-[11px] text-[#252321]/70 mt-1.5">
                          البحث الأولي مجاني. تدفع فقط إذا وجدنا لك نتيجة.
                        </p>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
        </section>

        {/* C. Section 2: Core Strengths (ما هو جذوري · نقاط القوة - 4 Cards) */}
        <section
          id="what-is-juthori"
          className="scroll-mt-20 border-t border-[#B98A78]/25 bg-[#EDE6DA]/55 py-16 lg:py-20"
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

        {/* E. Section 4: About Us */}
        <section
          id="about-us"
          className="scroll-mt-20 border-t border-[#B98A78]/25 bg-[#EDE6DA]/45 py-16 lg:py-20"
        >
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-4">
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
            </div>

            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/40 overflow-hidden flex flex-col">
                <div className="aspect-[16/10] overflow-hidden">
                  <ResilientImage
                    src={JUTHORI_MEDIA.manuscriptScroll}
                    alt="منهجية الفهرسة — تحقيق المخطوطات والمشجرات"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5">
                  <p className="text-xs text-[#D8755B] font-semibold mb-1">
                    منهجية الفهرسة · تحقيق المصادر
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
                    الضوابط والتوثيق · ميثاق أمين السجل
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
        </section>

        {/* F. Support & Contact Center (#support-center) */}
        <section
          id="support-center"
          className="scroll-mt-20 py-16 lg:py-20 max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8"
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
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigatePublicPage('support-center')}
                  className="px-4 py-2.5 rounded-xl bg-[#252321] hover:bg-[#3a3734] text-[#F3D299] text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span>فتح الدليل الإرشادي والمرشد الذكي الشامل ←</span>
                </button>
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
          </>
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#B98A78]/30 bg-[#EDE6DA]/70 py-12">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center space-y-3.5">
            <JuthoriLogo
              size="sm"
              onClick={() => navigatePublicPage('home')}
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
          </div>
        </div>
      </footer>
    </div>
  );
};