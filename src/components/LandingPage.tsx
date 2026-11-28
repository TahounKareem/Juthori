import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Database,
  Languages,
  Menu,
  ShieldCheck,
  Lock,
  CheckCircle2,
  Send,
  X,
  Mail,
  Loader2,
  Trees,
  Archive,
  Compass,
  Sparkles,
} from 'lucide-react';
import { JUTHORI_SERVICE_ICONS } from '../config/serviceIcons';
import { JuthoriLogo } from './JuthoriLogo';
import { ResilientImage } from './ResilientImage';
import { KnowledgeCenterView } from './KnowledgeCenterView';
import { SupportAndHelpCenterView } from './SupportAndHelpCenterView';
import { SubscriptionPricingSection } from './SubscriptionPricingSection';
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
  BillingCycle,
  SUBSCRIPTION_PLANS,
  SubscriptionPlanId,
  formatPlanPriceUsd,
  getPlanPriceUsd,
} from '../config/subscriptionPlans';
import {
  createSupportTicketInFirebase,
  fetchKnowledgeArticlesFromFirebase,
  KnowledgeArticleRecord,
} from '../services/firestoreService';

export interface SelectedPlanIntent {
  planId: 'basic' | 'premium';
  billingCycle: BillingCycle;
}

interface LandingPageProps {
  form: RegistrationFormState;
  onChangeForm: React.Dispatch<React.SetStateAction<RegistrationFormState>>;
  selectedPortalCountry: string;
  onSelectPortalCountry: (countryName: string) => void;
  onSubmitSearch: () => Promise<void>;
  onDirectFreeSignup?: (params: {
    email: string;
    password: string;
    selectedPlanIntent?: SelectedPlanIntent | null;
  }) => Promise<void>;
  onGoogleFreeSignup?: (
    selectedPlanIntent?: SelectedPlanIntent | null
  ) => Promise<void>;
  isSearching: boolean;
  searchStep: 1 | 2 | 3;
  onOpenLogin: () => void;
  isAuthenticated?: boolean;
  onOpenDashboardForPlan?: (intent: SelectedPlanIntent | null) => void;
  silentGeo: SilentGeoMetadata;
}

type PublicPageId =
  | 'home'
  | 'what-is-juthori'
  | 'pricing-plans'
  | 'knowledge-center'
  | 'support-center';

const PUBLIC_NAV_ITEMS: Array<{ id: PublicPageId; label: string }> = [
  { id: 'home', label: 'الرئيسية' },
  { id: 'what-is-juthori', label: 'ما هو جذوري' },
  { id: 'pricing-plans', label: 'الباقات والأسعار' },
  { id: 'knowledge-center', label: 'المركز المعرفي' },
  { id: 'support-center', label: 'التواصل والدعم' },
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
  `ابنِ شجرة عائلتك التفاعلية مجاناً حتى ${SUBSCRIPTION_PLANS.free.limits.maxTreeNodes} فرد`,
  `احفظ صور ووثائق الأجداد في خزانتك الآمنة مجاناً حتى ${SUBSCRIPTION_PLANS.free.limits.maxVaultItems} مقتنىً`,
  'استكشف ربط الجذور وعمود النسب الموثّق وأطلق موقع ديوان عائلتك المستقل',
];

const HERO_VALUE_CARDS = [
  {
    title: 'شجرتي التفاعلية',
    description: `مجانية حتى ${SUBSCRIPTION_PLANS.free.limits.maxTreeNodes} فرد لتأسيس فروع عائلتك`,
    icon: Trees,
  },
  {
    title: 'خزانة الذاكرة',
    description: `مجانية حتى ${SUBSCRIPTION_PLANS.free.limits.maxVaultItems} صورة ووثيقة عائلية محفوظة`,
    icon: Archive,
  },
  {
    title: 'رادار ربط الجذور',
    description: 'مطابقة خلفية مع السجلات التاريخية وترقية مرنة متى شئت',
    icon: Compass,
  },
];

const CORE_STRENGTHS = [
  {
    number: '01',
    title: 'ابدأ مجاناً بلا قيود',
    description: `أنشئ حسابك المجاني فوراً ($0 دائماً) وابدأ في بناء شجرتك حتى ${SUBSCRIPTION_PLANS.free.limits.maxTreeNodes} فرد وحفظ ${SUBSCRIPTION_PLANS.free.limits.maxVaultItems} مقتنىً دون الحاجة لبطاقة بنكية.`,
    icon: JUTHORI_SERVICE_ICONS.tree,
  },
  {
    number: '02',
    title: 'قاعدة بيانات نسبية مهيكلة',
    description:
      'أكثر من 2.27 مليون عقدة نسب ومصدر تاريخي مهيكل تغطي 22 دولة عربية والمهجر لربط عائلتك بجذورها الموثقة.',
    icon: Database,
  },
  {
    number: '03',
    title: 'التوثيق المرجعي الصارم',
    description:
      'لا تخمينات أو روايات مرسلة؛ كل ربط نسبي واكتشاف في «كشّافي» يُسند إلى مصادره وكتبه ومخطوطاته المعتمدة.',
    icon: ShieldCheck,
  },
  {
    number: '04',
    title: 'الخصوصية والسيادة العائلية',
    description:
      'بيانات شجرتك وخزانتك معزولة ومحمية بالكامل لحسابك، مع تحكم مطلق في من يطّلع على سجل العائلة أو موقعها.',
    icon: Lock,
  },
];

const PLATFORM_SERVICES_6 = [
  {
    number: '01',
    title: 'شجرتي (My Tree)',
    subtitle: `مجانية حتى ${SUBSCRIPTION_PLANS.free.limits.maxTreeNodes} فرد`,
    description:
      'استوديو تفاعلي مرن لتكوين شجرة العائلة وإضافة الأجيال والفروع، مع التوسعة والتصدير والطباعة في الباقات المدفوعة.',
    tierNote: 'متاحة مجاناً في باقة Free',
    icon: JUTHORI_SERVICE_ICONS.tree,
  },
  {
    number: '02',
    title: 'خزانتي (My Vault)',
    subtitle: `مجانية حتى ${SUBSCRIPTION_PLANS.free.limits.maxVaultItems} مقتنىً`,
    description:
      'وثّق واحفظ صور الأجداد والوثائق والذكريات العائلية في خزانة إلكترونية مشفرة ومصنفة بالمجلدات والأفراد.',
    tierNote: 'متاحة مجاناً في باقة Free',
    icon: JUTHORI_SERVICE_ICONS.vault,
  },
  {
    number: '03',
    title: 'ربط الجذور وعمود النسب',
    subtitle: 'السلسلة التاريخية الموثّقة',
    description:
      'افتح البحث الكامل عن ربط عائلتك بالمصادر التاريخية والقبائل الأم مع رادار خلفي ينبّهك عند رصد مطابقة.',
    tierNote: 'بدءاً من باقة Basic',
    icon: JUTHORI_SERVICE_ICONS.lineage,
  },
  {
    number: '04',
    title: 'كشّافي (My Discoveries) *',
    subtitle: 'اكتشافات ومصادر ووثائق أعمق',
    description:
      'معلومات عائلية أعمق، ومصادر ومراجع، ووثائق ومواد تاريخية، وقصص وسير، واكتشافات مستمرة تبعاً لتوفر المصادر.',
    tierNote: 'حصري لباقة Premium',
    icon: JUTHORI_SERVICE_ICONS.kashafi,
  },
  {
    number: '05',
    title: 'موقعي (My Site)',
    subtitle: 'بوابة رقمية مستقلة للعائلة',
    description:
      'صمّم ديوان عائلتك الإلكتروني في الاستوديو وانشره برابط مستقل مع تحكم كامل بالخصوصية عند الترقية واستيفاء الميثاق.',
    tierNote: 'النشر ضمن باقة Premium',
    icon: JUTHORI_SERVICE_ICONS.site,
  },
  {
    number: '06',
    title: 'مجتمعي ودائرة الأقارب',
    subtitle: 'صلة الرحم والتوثيق التشاركي',
    description:
      'ادعُ أقاربك إلى دائرة العائلة وشاركوا في إثراء الذاكرة وتنظيم المناسبات العائلية في بيئة موثوقة ومحفوظة.',
    tierNote: 'متكامل ضمن منظومة جذوري',
    icon: JUTHORI_SERVICE_ICONS.community,
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  form,
  onChangeForm,
  selectedPortalCountry,
  onSelectPortalCountry,
  onSubmitSearch,
  onDirectFreeSignup,
  onGoogleFreeSignup,
  isSearching,
  onOpenLogin,
  isAuthenticated = false,
  onOpenDashboardForPlan,
}) => {
  const [activePublicPage, setActivePublicPage] = useState<PublicPageId>('home');
  const [showOptionalTribe, setShowOptionalTribe] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Partial<Record<keyof RegistrationFormState | 'general', string>>
  >({});
  const [isSubmittingFreeSignup, setIsSubmittingFreeSignup] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [selectedPlanIntent, setSelectedPlanIntent] =
    useState<SelectedPlanIntent | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const firstNameInputRef = useRef<HTMLInputElement | null>(null);
  const [publishedArticles, setPublishedArticles] = useState<
    KnowledgeArticleRecord[]
  >([]);

  // Support form state
  const [supportName, setSupportName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSent, setSupportSent] = useState(false);
  const [supportError, setSupportError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [activePublicPage]);

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
      window.addEventListener(
        'juthori-knowledge-articles-updated',
        loadPublished
      );
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
      pageId === 'pricing-plans' ||
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
    }, 60);
  };

  const scrollToSignupCard = () => {
    if (activePublicPage !== 'home') {
      setActivePublicPage('home');
    }
    setTimeout(() => {
      const el = document.getElementById('free-signup-card');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      firstNameInputRef.current?.focus();
    }, 80);
  };

  const handleSelectPricingPlan = (
    planId: SubscriptionPlanId,
    billingCycle: BillingCycle
  ) => {
    const intent: SelectedPlanIntent | null =
      planId === 'free' ? null : { planId, billingCycle };

    if (isAuthenticated && onOpenDashboardForPlan) {
      onOpenDashboardForPlan(intent);
      return;
    }

    setSelectedPlanIntent(intent);
    scrollToSignupCard();
  };

  const handleFieldChange = <K extends keyof RegistrationFormState>(
    key: K,
    value: RegistrationFormState[K]
  ) => {
    onChangeForm((prev) => ({ ...prev, [key]: value }));
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      delete next.general;
      return next;
    });
  };

  const handleFreeSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Partial<
      Record<keyof RegistrationFormState | 'general', string>
    > = {};

    if (!form.firstName.trim()) {
      errors.firstName = 'يرجى إدخال الاسم الأول لتأسيس بطاقتك في شجرتي.';
    }
    if (!form.familyName.trim()) {
      errors.familyName = 'يرجى إدخال اسم العائلة.';
    }
    const cleanEmail = (form.email || '').trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = 'يرجى إدخال بريد إلكتروني صحيح.';
    }
    if (!form.password || form.password.length < 6) {
      errors.password = 'كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    if (onDirectFreeSignup) {
      setIsSubmittingFreeSignup(true);
      try {
        await onDirectFreeSignup({
          email: cleanEmail,
          password: form.password,
          selectedPlanIntent,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'TEAM_ACCOUNT_ISOLATED') {
          setValidationErrors({
            general:
              'عذراً، هذا البريد الإلكتروني مسجل ضمن حسابات فريق العمل والإدارة. يرجى الدخول عبر بوابة فريق العمل (/team).',
          });
        } else if (msg === 'WRONG_PASSWORD_EXISTING') {
          setValidationErrors({
            general:
              'هذا البريد مسجل بالفعل بكلمة مرور مختلفة. يرجى الضغط على «تسجيل الدخول» أدناه للدخول لحسابك.',
          });
        } else {
          setValidationErrors({
            general:
              'تعذر إتمام إنشاء الحساب حالياً. يرجى المحاولة مجدداً أو الدخول بحساب Google.',
          });
        }
      } finally {
        setIsSubmittingFreeSignup(false);
      }
      return;
    }

    await onSubmitSearch();
  };

  const handleGoogleQuickStart = async () => {
    if (!onGoogleFreeSignup) {
      onOpenLogin();
      return;
    }
    setValidationErrors({});
    setIsGoogleLoading(true);
    try {
      await onGoogleFreeSignup(selectedPlanIntent);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'TEAM_ACCOUNT_ISOLATED') {
        setValidationErrors({
          general:
            'عذراً، هذا البريد مسجل ضمن حسابات فريق العمل والإدارة. يرجى الدخول عبر بوابة (/team).',
        });
      } else if (!msg.includes('popup-closed-by-user')) {
        setValidationErrors({
          general:
            'تعذر التسجيل عبر Google في هذه النافذة. يمكنك إنشاء حسابك المجاني بالبريد الإلكتروني أدناه.',
        });
      }
    } finally {
      setIsGoogleLoading(false);
    }
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
    <div
      dir="rtl"
      className="min-h-screen bg-[#F5F1E8] text-[#1F1F1C] flex flex-col justify-between overflow-x-hidden"
    >
      {/* A. Top Navigation Bar (Warm Heritage Ivory · Clean 3-Zone Contract) */}
      <header className="sticky top-0 z-40 bg-[#F5F1E8]/95 backdrop-blur-xs border-b border-[#D8C7B2]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4 sm:gap-6">
          {/* Zone 1: Brand Wordmark */}
          <JuthoriLogo
            size="md"
            onClick={() => navigatePublicPage('home')}
          />

          {/* Zone 2: 5 Clean Single-Line Nav Links */}
          <nav
            aria-label="التنقل الرئيسي"
            className="hidden lg:flex items-center gap-5 text-sm font-display font-bold"
          >
            {PUBLIC_NAV_ITEMS.map((item) => {
              const isActive = activePublicPage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigatePublicPage(item.id)}
                  className={`py-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                    isActive
                      ? 'text-[#D97757] border-[#D97757]'
                      : 'text-[#1F1F1C]/80 border-transparent hover:text-[#1F1F1C] hover:border-[#D8C7B2]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Country + Language + Login / Mobile Menu */}
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
                className="appearance-none rounded-xl bg-[#E8DED2] border border-[#D8C7B2] pr-2.5 sm:pr-3.5 pl-7 sm:pl-8 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-[#1F1F1C] max-w-[135px] sm:max-w-[190px] truncate focus:outline-none focus:border-[#D97757] cursor-pointer"
              >
                {PORTAL_COUNTRY_SWITCHER_OPTIONS.map((country) => (
                  <option key={country.code} value={country.name}>
                    {country.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1F1F1C]/70 pointer-events-none absolute left-2 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
            </div>

            <div className="relative" ref={languageMenuRef}>
              <button
                type="button"
                onClick={() => setLanguageMenuOpen((v) => !v)}
                aria-label="اختيار لغة الموقع"
                aria-expanded={languageMenuOpen}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#E8DED2] hover:bg-[#D8C7B2]/60 border border-[#D8C7B2] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-display font-bold text-[#1F1F1C] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Languages
                  className="w-4 h-4 text-[#D97757] shrink-0"
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">العربية</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#1F1F1C]/70 transition-transform ${
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
                    className="absolute left-0 mt-2 w-48 rounded-2xl bg-[#FAF7F2] border border-[#D8C7B2] shadow-xl py-2 z-50"
                    role="menu"
                    aria-label="قائمة لغات الموقع"
                  >
                    <div className="px-3.5 py-1.5 border-b border-[#D8C7B2]/70 text-[11px] font-display font-bold text-[#D97757]">
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
                              ? 'bg-[#E8DED2]/70 text-[#1F1F1C] font-extrabold cursor-pointer'
                              : 'text-[#1F1F1C]/40 cursor-not-allowed'
                          }`}
                        >
                          <span>{lang.label}</span>
                          {lang.enabled ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#D97757]" />
                          ) : (
                            <span className="text-[10px] text-[#1F1F1C]/45 font-normal">
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
              className="hidden lg:inline-flex px-4 py-2 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs sm:text-sm font-display font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              تسجيل الدخول
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden w-10 h-10 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] flex items-center justify-center text-[#1F1F1C] cursor-pointer shrink-0"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Slide-over Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 top-16 sm:top-20 z-40 bg-[#1F1F1C]/35 backdrop-blur-xs lg:hidden"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 260 }}
                aria-label="القائمة الجانبية للجوال"
                className="fixed top-16 sm:top-20 left-0 bottom-0 z-50 w-[82vw] max-w-[320px] bg-[#F5F1E8] border-r border-[#D8C7B2] shadow-2xl p-5 flex flex-col justify-between lg:hidden overflow-y-auto"
              >
                <div className="space-y-4">
                  <div className="pb-3 border-b border-[#D8C7B2] flex items-center justify-between">
                    <span className="text-xs font-display font-bold text-[#D97757]">
                      تصفح بوابة جذوري
                    </span>
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-1.5 rounded-lg hover:bg-[#E8DED2] text-[#1F1F1C] cursor-pointer"
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
                              ? 'bg-[#D97757] text-[#F5F1E8]'
                              : 'text-[#1F1F1C] hover:bg-[#E8DED2]'
                          }`}
                        >
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </nav>

                  <div className="pt-3 border-t border-[#D8C7B2] space-y-1.5">
                    <label
                      htmlFor="mobile-country-switcher"
                      className="block text-xs font-bold text-[#1F1F1C]/80"
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
                      className="w-full rounded-xl bg-[#E8DED2] border border-[#D8C7B2] px-3 py-2.5 text-sm font-semibold text-[#1F1F1C]"
                    >
                      {PORTAL_COUNTRY_SWITCHER_OPTIONS.map((c) => (
                        <option key={c.code} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#D8C7B2]">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenLogin();
                    }}
                    className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-sm font-display font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>تسجيل الدخول</span>
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
              onOpenKnowledgeCenter={() =>
                navigatePublicPage('knowledge-center')
              }
            />
          </section>
        ) : activePublicPage === 'pricing-plans' ? (
          <section
            id="pricing-plans-page"
            className="py-10 sm:py-14 max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[#D8C7B2]">
              <button
                type="button"
                onClick={() => navigatePublicPage('home')}
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-display font-bold text-[#1F1F1C]/80 hover:text-[#D97757] transition-colors cursor-pointer"
              >
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>العودة إلى الصفحة الرئيسية</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isAuthenticated && onOpenDashboardForPlan) {
                    onOpenDashboardForPlan(null);
                  } else {
                    onOpenLogin();
                  }
                }}
                className="text-xs sm:text-sm font-display font-bold text-[#D97757] hover:underline cursor-pointer"
              >
                {isAuthenticated
                  ? 'الانتقال إلى لوحة التحكم والترقية'
                  : 'لديك حساب بالفعل؟ تسجيل الدخول للترقية'}
              </button>
            </div>

            <SubscriptionPricingSection
              mode="landing"
              initialCycle="annual"
              onSelectPlan={handleSelectPricingPlan}
              showComparisonTable={true}
            />
          </section>
        ) : (
          <>
            {/* B. Geo-Dynamic Panoramic Heritage Hero + Bright Warm Ivory Free Account Registration */}
            <section
              id="hero-portal"
              className="scroll-mt-20 relative w-full overflow-hidden py-10 sm:py-14 lg:py-16 border-b border-[#D8C7B2] bg-[#2B1F16]"
            >
              {/* Full-Bleed Geo-Dynamic Architectural Photograph with Smooth Crossfade & Warm Bronze/Sepia Vignette */}
              <div className="absolute inset-0 z-0">
                <AnimatePresence mode="sync">
                  <motion.div
                    key={`${countryInfo.code}-${countryInfo.heroImageUrl}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    className="absolute inset-0"
                  >
                    <ResilientImage
                      src={
                        countryInfo.heroImageUrl ||
                        JUTHORI_MEDIA.heritageCourtyard
                      }
                      fallbackSrc={JUTHORI_MEDIA.heritageCourtyard}
                      loading="eager"
                      alt={`التراث المعماري الأصيل — ${countryInfo.name}`}
                      className="w-full h-full object-cover object-center"
                    />
                  </motion.div>
                </AnimatePresence>
                {/* Warm Bronze / Sepia Cinematic Vignette Overlay for High-Contrast Ivory & Gold Typography */}
                <div className="absolute inset-0 bg-gradient-to-l from-[#241810]/86 via-[#332216]/68 to-[#22160E]/48 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1E140D]/72 via-transparent to-[#281B12]/35 pointer-events-none" />
              </div>

              <div className="relative z-10 max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
                <div className="grid grid-cols-1 lg:grid-cols-12 items-start gap-8 lg:gap-10">
                  {/* RIGHT COLUMN (First in RTL): Ivory & Warm Gold Editorial Hero over Country Photograph */}
                  <div className="lg:col-span-7 flex flex-col justify-center space-y-6 pt-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-display font-bold text-[#F3C593]">
                      <span>منصة العائلة والأنساب العربية</span>
                      <span aria-hidden="true" className="text-[#F5F1E8]/45">
                        ·
                      </span>
                      <span className="text-[#FAF7F2]/90">
                        بوابة {countryInfo.name} ({countryInfo.regionLabel})
                      </span>
                    </div>

                    <div className="space-y-4">
                      <h1 className="text-3xl sm:text-4xl lg:text-[46px] font-display font-extrabold text-[#FAF7F2] leading-[1.2] tracking-tight text-balance drop-shadow-[0_2px_14px_rgba(24,14,8,0.45)]">
                        أسّس شجرة عائلتك واحفظ ذاكرتها..{' '}
                        <span className="text-[#F2B57E] sm:block mt-1">
                          واكتشف جذورك الموثّقة
                        </span>
                      </h1>

                      <p className="text-sm sm:text-base text-[#F5F1E8]/90 leading-relaxed max-w-2xl">
                        ابدأ اليوم بحساب مجاني دائم يمنحك دخولاً مباشراً لبناء شجرة عائلتك وحفظ صور ووثائق الأجداد في خزانتك الآمنة، بينما يعمل رادار جذوري في الخلفية للبحث عن ربط نسبك بالمصادر التاريخية.
                      </p>

                      <ul className="space-y-2.5 pt-1">
                        {HERO_BULLET_POINTS.map((point) => (
                          <li
                            key={point}
                            className="flex items-start gap-2.5 text-sm sm:text-[15px] font-display font-bold text-[#FAF7F2]"
                          >
                            <CheckCircle2
                              className="w-4 h-4 text-[#F0A47A] shrink-0 mt-1"
                              aria-hidden="true"
                            />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Airy Translucent Regional Slogan Frame (Lets Country Photography Breathe Behind Text) */}
                    <div className="rounded-2xl bg-[#FAF7F2]/10 backdrop-blur-xs border border-[#F5F1E8]/25 p-4 sm:p-5 max-w-2xl space-y-1.5">
                      <div className="text-[11px] font-display font-bold text-[#F3C593]">
                        {countryInfo.name} · {countryInfo.regionLabel}
                      </div>
                      <p className="text-base sm:text-lg font-display font-extrabold text-[#FAF7F2] leading-snug">
                        «{countryInfo.slogan}»
                      </p>
                      <p className="text-xs sm:text-sm text-[#F5F1E8]/85 leading-relaxed">
                        {countryInfo.heritageNote}
                      </p>
                    </div>

                    {/* Clean Airy 3-Pillar Strip over Panoramic Hero */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl pt-4 border-t border-[#F5F1E8]/22">
                      {HERO_VALUE_CARDS.map((card) => {
                        const Icon = card.icon;
                        return (
                          <div
                            key={card.title}
                            className="flex items-start gap-2.5"
                          >
                            <div className="w-8 h-8 rounded-xl bg-[#FAF7F2]/12 border border-[#F5F1E8]/25 flex items-center justify-center text-[#F3C593] shrink-0 mt-0.5">
                              <Icon className="w-4 h-4" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-display font-extrabold text-[#FAF7F2] leading-tight">
                                {card.title}
                              </p>
                              <p className="text-[11px] text-[#F5F1E8]/80 mt-1 leading-snug">
                                {card.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* LEFT COLUMN (Second in RTL): Bright Warm Ivory Free Account Registration Card */}
                  <div className="lg:col-span-5 flex justify-center lg:justify-end w-full">
                    <div
                      id="free-signup-card"
                      className="w-full max-w-full md:max-w-[440px] rounded-3xl bg-[#FDFBF7] border border-[#D8C7B2] p-5 sm:p-6 shadow-[0_24px_55px_-28px_rgba(31,31,28,0.22)] text-[#1F1F1C] space-y-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs font-display font-bold text-[#D97757]">
                          <span>حساب مجاني دائم · $0</span>
                          <span className="text-[#1F1F1C]/60">
                            دخول مباشر للوحة التحكم
                          </span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-display font-extrabold text-[#1F1F1C] leading-snug">
                          أنشئ حسابك المجاني وابدأ شجرة عائلتك
                        </h2>
                        <p className="text-xs text-[#1F1F1C]/70 leading-relaxed">
                          تُؤسَّس بطاقتك الأولى في «شجرتي» فوراً وتُدرج عائلتك في رادار ربط الجذور الخلفي تلقائياً.
                        </p>
                      </div>

                      {/* Selected Paid Plan Intent Notice (if clicked from Pricing Table) */}
                      {selectedPlanIntent && (
                        <div className="rounded-2xl bg-[#E8DED2] border border-[#D97757]/50 px-3.5 py-2.5 flex items-start justify-between gap-2 text-xs">
                          <div className="flex items-start gap-2">
                            <Sparkles className="w-4 h-4 text-[#D97757] shrink-0 mt-0.5" />
                            <div className="leading-snug">
                              <span className="font-display font-extrabold text-[#1F1F1C]">
                                تم اختيار باقة{' '}
                                {SUBSCRIPTION_PLANS[selectedPlanIntent.planId].code}{' '}
                                (
                                {formatPlanPriceUsd(
                                  getPlanPriceUsd(
                                    selectedPlanIntent.planId,
                                    selectedPlanIntent.billingCycle
                                  )
                                )}
                                {selectedPlanIntent.billingCycle === 'annual'
                                  ? '/سنة'
                                  : '/شهر'}
                                )
                              </span>
                              <span className="block text-[11px] text-[#1F1F1C]/75 mt-0.5">
                                أكمل إنشاء حسابك المجاني الآن لتنتقل مباشرة إلى تفعيل الباقة داخل لوحة التحكم.
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedPlanIntent(null)}
                            aria-label="إلغاء اختيار الباقة المدفوعة"
                            className="p-1 rounded-lg hover:bg-[#F5F1E8] text-[#1F1F1C]/60 cursor-pointer shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Google One-Click Free Signup */}
                      <button
                        type="button"
                        onClick={handleGoogleQuickStart}
                        disabled={isGoogleLoading || isSubmittingFreeSignup}
                        className="w-full min-h-[42px] py-2.5 px-4 rounded-xl bg-[#FAF7F2] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60"
                      >
                        {isGoogleLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[#D97757]" />
                        ) : (
                          <svg
                            className="w-4 h-4 shrink-0"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              fill="#D97757"
                              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                            />
                            <path
                              fill="#D97757"
                              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                            />
                            <path
                              fill="#D8C7B2"
                              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                            />
                            <path
                              fill="#D97757"
                              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                            />
                          </svg>
                        )}
                        <span>المتابعة السريعة بحساب Google</span>
                      </button>

                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-[#D8C7B2]" />
                        <span className="text-[11px] font-medium text-[#1F1F1C]/55">
                          أو أنشئ حسابك بالبريد الإلكتروني
                        </span>
                        <div className="flex-1 h-px bg-[#D8C7B2]" />
                      </div>

                      <form
                        onSubmit={handleFreeSignupSubmit}
                        className="space-y-3"
                        noValidate
                      >
                        {/* Row 1: First Name, Father Name, Grandfather Name */}
                        <div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label
                                htmlFor="input-first-name"
                                className="block text-[11px] font-bold text-[#1F1F1C] mb-1 truncate"
                              >
                                الاسم الأول *
                              </label>
                              <input
                                ref={firstNameInputRef}
                                id="input-first-name"
                                type="text"
                                value={form.firstName}
                                onChange={(e) =>
                                  handleFieldChange('firstName', e.target.value)
                                }
                                placeholder="مثال: كريم"
                                className="w-full h-9 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-2.5 text-sm text-[#1F1F1C] placeholder:text-[#1F1F1C]/35 focus:outline-none focus:bg-[#FDFBF7] focus:border-[#D97757]"
                              />
                            </div>

                            <div>
                              <label
                                htmlFor="input-father-name"
                                className="block text-[11px] font-bold text-[#1F1F1C] mb-1 truncate"
                              >
                                اسم الأب
                              </label>
                              <input
                                id="input-father-name"
                                type="text"
                                value={form.fatherName}
                                onChange={(e) =>
                                  handleFieldChange(
                                    'fatherName',
                                    e.target.value
                                  )
                                }
                                placeholder="مثال: شريف"
                                className="w-full h-9 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-2.5 text-sm text-[#1F1F1C] placeholder:text-[#1F1F1C]/35 focus:outline-none focus:bg-[#FDFBF7] focus:border-[#D97757]"
                              />
                            </div>

                            <div>
                              <label
                                htmlFor="input-grandfather-name"
                                className="block text-[11px] font-bold text-[#1F1F1C] mb-1 truncate"
                              >
                                اسم الجد
                              </label>
                              <input
                                id="input-grandfather-name"
                                type="text"
                                value={form.grandfatherName}
                                onChange={(e) =>
                                  handleFieldChange(
                                    'grandfatherName',
                                    e.target.value
                                  )
                                }
                                placeholder="مثال: خيري"
                                className="w-full h-9 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-2.5 text-sm text-[#1F1F1C] placeholder:text-[#1F1F1C]/35 focus:outline-none focus:bg-[#FDFBF7] focus:border-[#D97757]"
                              />
                            </div>
                          </div>
                          {validationErrors.firstName && (
                            <p className="mt-1 text-[11px] text-[#D97757] font-semibold">
                              {validationErrors.firstName}
                            </p>
                          )}
                        </div>

                        {/* Row 2: Family Name & Country */}
                        <div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label
                                htmlFor="input-family-name"
                                className="block text-[11px] font-bold text-[#1F1F1C] mb-1 truncate"
                              >
                                اسم العائلة *
                              </label>
                              <input
                                id="input-family-name"
                                type="text"
                                value={form.familyName}
                                onChange={(e) =>
                                  handleFieldChange(
                                    'familyName',
                                    e.target.value
                                  )
                                }
                                placeholder="مثال: آل مقيت"
                                className="w-full h-9 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-2.5 text-sm text-[#1F1F1C] placeholder:text-[#1F1F1C]/35 focus:outline-none focus:bg-[#FDFBF7] focus:border-[#D97757]"
                              />
                            </div>

                            <div>
                              <label
                                htmlFor="input-origin-country"
                                className="block text-[11px] font-bold text-[#1F1F1C] mb-1 truncate"
                              >
                                الدولة
                              </label>
                              <div className="relative">
                                <select
                                  id="input-origin-country"
                                  value={form.originCountry}
                                  onChange={(e) => {
                                    handleFieldChange(
                                      'originCountry',
                                      e.target.value
                                    );
                                    if (e.target.value) {
                                      onSelectPortalCountry(e.target.value);
                                    }
                                  }}
                                  className="w-full h-9 appearance-none rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] pr-2.5 pl-7 text-xs sm:text-sm text-[#1F1F1C] focus:outline-none focus:bg-[#FDFBF7] focus:border-[#D97757] cursor-pointer"
                                >
                                  <option value="">اختر الدولة</option>
                                  {ORIGIN_COUNTRY_OPTIONS.map((country) => (
                                    <option key={country} value={country}>
                                      {country}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown
                                  className="w-3.5 h-3.5 text-[#1F1F1C]/65 pointer-events-none absolute left-2 top-1/2 -translate-y-1/2"
                                  aria-hidden="true"
                                />
                              </div>
                            </div>
                          </div>
                          {validationErrors.familyName && (
                            <p className="mt-1 text-[11px] text-[#D97757] font-semibold">
                              {validationErrors.familyName}
                            </p>
                          )}
                        </div>

                        {/* Row 3: Email & Password */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label
                              htmlFor="input-signup-email"
                              className="block text-[11px] font-bold text-[#1F1F1C] mb-1"
                            >
                              البريد الإلكتروني *
                            </label>
                            <div className="relative">
                              <input
                                id="input-signup-email"
                                type="email"
                                dir="ltr"
                                value={form.email}
                                onChange={(e) =>
                                  handleFieldChange('email', e.target.value)
                                }
                                placeholder="name@example.com"
                                className="w-full h-9 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-2.5 pl-8 text-right text-xs sm:text-sm text-[#1F1F1C] placeholder:text-[#1F1F1C]/35 focus:outline-none focus:bg-[#FDFBF7] focus:border-[#D97757]"
                              />
                              <Mail
                                className="w-3.5 h-3.5 text-[#D97757] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                aria-hidden="true"
                              />
                            </div>
                            {validationErrors.email && (
                              <p className="mt-1 text-[11px] text-[#D97757] font-semibold">
                                {validationErrors.email}
                              </p>
                            )}
                          </div>

                          <div>
                            <label
                              htmlFor="input-signup-password"
                              className="block text-[11px] font-bold text-[#1F1F1C] mb-1"
                            >
                              كلمة المرور *
                            </label>
                            <div className="relative">
                              <input
                                id="input-signup-password"
                                type="password"
                                dir="ltr"
                                value={form.password}
                                onChange={(e) =>
                                  handleFieldChange('password', e.target.value)
                                }
                                placeholder="6 أحرف فأكثر"
                                className="w-full h-9 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-2.5 pl-8 text-right text-xs sm:text-sm text-[#1F1F1C] placeholder:text-[#1F1F1C]/35 focus:outline-none focus:bg-[#FDFBF7] focus:border-[#D97757]"
                              />
                              <Lock
                                className="w-3.5 h-3.5 text-[#D97757] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                aria-hidden="true"
                              />
                            </div>
                            {validationErrors.password && (
                              <p className="mt-1 text-[11px] text-[#D97757] font-semibold">
                                {validationErrors.password}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Optional Origin Region / Tribe Accordion for Background Lineage Radar */}
                        <div className="rounded-xl border border-[#D8C7B2] bg-[#FAF7F2] overflow-hidden">
                          <button
                            type="button"
                            aria-expanded={showOptionalTribe}
                            onClick={() =>
                              setShowOptionalTribe((prev) => !prev)
                            }
                            className="w-full px-3 py-2 flex items-center justify-between text-right text-xs font-display font-bold text-[#1F1F1C] hover:bg-[#E8DED2]/60 transition-colors cursor-pointer"
                          >
                            <span>
                              + الموطن / القبيلة (اختياري لدقة رادار الجذور)
                            </span>
                            {showOptionalTribe ? (
                              <ChevronUp
                                className="w-3.5 h-3.5 text-[#D97757]"
                                aria-hidden="true"
                              />
                            ) : (
                              <ChevronDown
                                className="w-3.5 h-3.5 text-[#D97757]"
                                aria-hidden="true"
                              />
                            )}
                          </button>

                          <AnimatePresence initial={false}>
                            {showOptionalTribe && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.15 }}
                                className="px-3 pb-3 pt-2 border-t border-[#D8C7B2]/70 space-y-2"
                              >
                                <div>
                                  <label
                                    htmlFor="input-origin-region"
                                    className="block text-[11px] font-bold text-[#1F1F1C] mb-1"
                                  >
                                    الموطن / المحافظة (اختياري)
                                  </label>
                                  <input
                                    id="input-origin-region"
                                    type="text"
                                    value={form.originRegion || ''}
                                    onChange={(e) =>
                                      handleFieldChange(
                                        'originRegion',
                                        e.target.value
                                      )
                                    }
                                    placeholder="مثال: نجد، الحجاز، الشرقية، دير الزور..."
                                    className="w-full h-9 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-2.5 text-xs text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label
                                      htmlFor="input-tribe-name"
                                      className="block text-[11px] font-bold text-[#1F1F1C] mb-1"
                                    >
                                      القبيلة (إن وجدت)
                                    </label>
                                    <input
                                      id="input-tribe-name"
                                      type="text"
                                      value={form.tribeName}
                                      onChange={(e) =>
                                        handleFieldChange(
                                          'tribeName',
                                          e.target.value
                                        )
                                      }
                                      placeholder="مثال: قحطان / تميم"
                                      className="w-full h-9 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-2.5 text-xs text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                                    />
                                  </div>
                                  <div>
                                    <label
                                      htmlFor="input-branch-name"
                                      className="block text-[11px] font-bold text-[#1F1F1C] mb-1"
                                    >
                                      الفخذ / الفرع
                                    </label>
                                    <input
                                      id="input-branch-name"
                                      type="text"
                                      value={form.branchName}
                                      onChange={(e) =>
                                        handleFieldChange(
                                          'branchName',
                                          e.target.value
                                        )
                                      }
                                      placeholder="مثال: آل برمان"
                                      className="w-full h-9 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-2.5 text-xs text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                                    />
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {validationErrors.general && (
                          <div
                            role="alert"
                            className="rounded-xl bg-[#E8DED2] border border-[#D97757] px-3 py-2 text-[11.5px] font-bold text-[#1F1F1C]"
                          >
                            {validationErrors.general}
                          </div>
                        )}

                        {/* Primary Free Account CTA */}
                        <div className="pt-1 space-y-2">
                          <button
                            type="submit"
                            disabled={isSubmittingFreeSignup || isSearching}
                            className="w-full min-h-[46px] py-3 px-4 rounded-2xl bg-[#D97757] hover:bg-[#C46546] disabled:opacity-70 text-[#F5F1E8] font-display font-extrabold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                          >
                            {isSubmittingFreeSignup || isSearching ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>جاري تأسيس حسابك المجاني...</span>
                              </>
                            ) : (
                              <span>
                                {SUBSCRIPTION_PLANS.free.ctaLabelAr}
                              </span>
                            )}
                          </button>
                          <p className="text-center text-[11px] text-[#1F1F1C]/65">
                            شجرتي ({SUBSCRIPTION_PLANS.free.limits.maxTreeNodes} فرد) وخزانتي ({SUBSCRIPTION_PLANS.free.limits.maxVaultItems} مقتنىً) مجاناً · بدون بطاقة بنكية
                          </p>
                        </div>
                      </form>

                      <div className="pt-2 border-t border-[#D8C7B2]/70 text-center">
                        <button
                          type="button"
                          onClick={onOpenLogin}
                          className="text-xs font-display font-bold text-[#D97757] hover:underline cursor-pointer"
                        >
                          لديك حساب بالفعل؟ تسجيل الدخول إلى لوحة التحكم
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* C. Section 2: Core Strengths (ما هو جذوري · ركائز المنصة) */}
            <section
              id="what-is-juthori"
              className="scroll-mt-20 bg-[#E8DED2]/50 py-16 lg:py-20"
            >
              <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-2xl mb-12 space-y-2">
                  <p className="text-xs font-display font-bold text-[#D97757]">
                    ما هو جذوري · ركائز المنصة
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#1F1F1C] text-balance">
                    منصة عربية متكاملة تجمع بناء الشجرة وصون الذاكرة وتحقيق الأنساب
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {CORE_STRENGTHS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <article
                        key={item.number}
                        className="rounded-2xl bg-[#FAF7F2] border border-[#D8C7B2] p-6 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-5">
                            <span className="text-sm font-mono font-bold text-[#D97757] tabular-nums">
                              {item.number}
                            </span>
                            <div className="w-10 h-10 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] flex items-center justify-center text-[#D97757]">
                              <Icon className="w-5 h-5" aria-hidden="true" />
                            </div>
                          </div>
                          <h3 className="text-lg font-display font-extrabold text-[#1F1F1C] mb-2">
                            {item.title}
                          </h3>
                          <p className="text-sm text-[#1F1F1C]/80 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* E. Section 4: The 6 Platform Services */}
            <section className="py-16 lg:py-24 max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
                <div className="max-w-2xl space-y-2">
                  <p className="text-xs font-display font-bold text-[#D97757]">
                    منظومة خدمات جذوري المتكاملة
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#1F1F1C] text-balance">
                    ستة أعمدة رقمية لحفظ إرث العائلة وتوثيق نسبها عبر الأجيال
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={scrollToSignupCard}
                  className="self-start md:self-auto px-5 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs sm:text-sm font-display font-bold transition-colors cursor-pointer whitespace-nowrap"
                >
                  ابدأ حسابك المجاني الآن
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
                {PLATFORM_SERVICES_6.map((service, index) => {
                  const Icon = service.icon;
                  const isFreeCore = index === 0 || index === 1;
                  return (
                    <article
                      key={service.number}
                      className={`rounded-2xl p-6 flex flex-col justify-between border transition-transform duration-150 hover:-translate-y-0.5 ${
                        isFreeCore
                          ? 'bg-[#FDFBF7] border-[#D97757]/60'
                          : 'bg-[#FAF7F2] border-[#D8C7B2]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-5">
                          <span className="text-xs font-mono font-bold text-[#D97757] tabular-nums">
                            {service.number}
                          </span>
                          <div className="w-10 h-10 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] flex items-center justify-center text-[#D97757]">
                            <Icon className="w-5 h-5" aria-hidden="true" />
                          </div>
                        </div>

                        <h3 className="text-lg font-display font-extrabold text-[#1F1F1C] leading-snug mb-1">
                          {service.title}
                        </h3>
                        <p className="text-xs font-display font-bold text-[#D97757] mb-3">
                          {service.subtitle}
                        </p>
                        <p className="text-sm text-[#1F1F1C]/80 leading-relaxed">
                          {service.description}
                        </p>
                      </div>

                      <div className="mt-6 pt-4 border-t border-[#D8C7B2]/75 text-xs font-display font-bold text-[#1F1F1C]/70">
                        {service.tierNote}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* F. Section 5: About Us & Methodology */}
            <section
              id="about-us"
              className="scroll-mt-20 border-t border-[#D8C7B2] bg-[#E8DED2]/45 py-16 lg:py-20"
            >
              <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                <div className="lg:col-span-6 space-y-4">
                  <p className="text-xs font-display font-bold text-[#D97757]">
                    من نحن · منهجية الفهرسة والتحقيق
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#1F1F1C] text-balance">
                    مشروع عربي يجمع تحقيق المخطوطات التراثية وهندسة قواعد البيانات العلائقية
                  </h2>
                  <p className="text-sm sm:text-base text-[#1F1F1C]/80 leading-relaxed">
                    تأسست منصة «جذوري» لتمكين كل أسرة عربية في 22 دولة والمهجر من تأسيس شجرتها التفاعلية وحفظ وثائقها مجاناً، والارتقاء متى شاءت إلى ربط جذورها بأمهات كتب الأنساب وإطلاق بوابتها الرقمية المستقلة وفق ضوابط شرعية وقانونية تحفظ خصوصية العائلات.
                  </p>
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#D8C7B2]">
                    <div>
                      <div className="text-2xl font-display font-extrabold text-[#1F1F1C] tabular-nums">
                        +2.27M
                      </div>
                      <div className="text-xs text-[#1F1F1C]/70 mt-0.5">
                        عقدة نسب مهيكلة
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-display font-extrabold text-[#1F1F1C] tabular-nums">
                        {SUBSCRIPTION_PLANS.free.limits.maxTreeNodes}
                      </div>
                      <div className="text-xs text-[#1F1F1C]/70 mt-0.5">
                        فرد ومقتنىً مجاناً
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-display font-extrabold text-[#D97757] tabular-nums">
                        $0
                      </div>
                      <div className="text-xs text-[#1F1F1C]/70 mt-0.5">
                        للبدء الدائم في جذوري
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="rounded-2xl bg-[#FAF7F2] border border-[#D8C7B2] overflow-hidden flex flex-col">
                    <div className="aspect-[16/10] overflow-hidden">
                      <ResilientImage
                        src={JUTHORI_MEDIA.manuscriptScroll}
                        alt="منهجية الفهرسة — تحقيق المخطوطات والمشجرات"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-5">
                      <p className="text-xs text-[#D97757] font-display font-bold mb-1">
                        منهجية الفهرسة · تحقيق المصادر
                      </p>
                      <h3 className="text-base font-display font-extrabold text-[#1F1F1C] mb-1.5">
                        مراتب الطبقات والربط الثلاثي بالجذر
                      </h3>
                      <p className="text-xs text-[#1F1F1C]/75 leading-relaxed">
                        نطابق العقدة العائلية بالفرع القبلي الموثق والقبيلة الأم صعوداً إلى الجذوم الكبرى مع إسناد صريح للمراجع المحققة.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#FAF7F2] border border-[#D8C7B2] overflow-hidden flex flex-col">
                    <div className="aspect-[16/10] overflow-hidden">
                      <ResilientImage
                        src={JUTHORI_MEDIA.memoryVault}
                        alt="خزانة الذاكرة — صون الوثائق والصور العائلية"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-5">
                      <p className="text-xs text-[#D97757] font-display font-bold mb-1">
                        خزانة الذاكرة · ميثاق أمين السجل
                      </p>
                      <h3 className="text-base font-display font-extrabold text-[#1F1F1C] mb-1.5">
                        صون الوثائق ونشر البوابة المستقلة
                      </h3>
                      <p className="text-xs text-[#1F1F1C]/75 leading-relaxed">
                        احفظ صورك ووثائقك بخصوصية تامة، وعندما تقرر نشر موقع عائلتك المستقل يوثق ميثاق أمين السجل دقة وأمانة السجل.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* G. Support & Contact Center */}
            <section
              id="support-center"
              className="scroll-mt-20 py-16 lg:py-20 max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8"
            >
              <div className="rounded-3xl bg-[#E8DED2] border border-[#D8C7B2] p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-5 space-y-3">
                  <p className="text-xs font-display font-bold text-[#D97757]">
                    مركز التواصل والدعم
                  </p>
                  <h2 className="text-2xl font-display font-extrabold text-[#1F1F1C]">
                    هل لديك مشجرة عائلية محققة أو استفسار نسبي؟
                  </h2>
                  <p className="text-sm text-[#1F1F1C]/80 leading-relaxed">
                    يستقبل فريق التحقيق والأرشفة في منصة جذوري استفسارات العائلات وطلبات توثيق المشجرات الأسرية في جميع الدول العربية.
                  </p>
                  <div className="pt-2 text-xs text-[#1F1F1C]/75 space-y-1">
                    <p>البريد الرسمي: info@Juthori.com</p>
                    <p>
                      ساعات عمل لجنة التحقيق: الأحد – الخميس (9:00 ص – 6:00 م بتوقيت مكة المكرمة)
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => navigatePublicPage('support-center')}
                      className="px-4 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <span>فتح الدليل الإرشادي والأسئلة الشائعة</span>
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-7">
                  {supportSent ? (
                    <div className="rounded-2xl bg-[#FAF7F2] border border-[#D8C7B2] p-6 text-right">
                      <h3 className="text-base font-display font-extrabold text-[#D97757] mb-1">
                        تم استلام رسالتك بنجاح في مركز التواصل والدعم
                      </h3>
                      <p className="text-sm text-[#1F1F1C]/80 mb-4">
                        سيتواصل معك فريق التحقيق وخدمة العملاء عبر بريدك الإلكتروني خلال 24 ساعة عمل.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSupportSent(false)}
                        className="px-4 py-2 rounded-xl bg-[#E8DED2] hover:bg-[#D8C7B2] border border-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-bold cursor-pointer"
                      >
                        إرسال رسالة أخرى
                      </button>
                    </div>
                  ) : (
                    <form
                      onSubmit={handleSupportSubmit}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                      noValidate
                    >
                      <div>
                        <label
                          htmlFor="support-name"
                          className="block text-xs font-bold text-[#1F1F1C] mb-1"
                        >
                          الاسم الكامل
                        </label>
                        <input
                          id="support-name"
                          type="text"
                          value={supportName}
                          onChange={(e) => setSupportName(e.target.value)}
                          placeholder="الاسم الثلاثي"
                          className="w-full rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] px-3.5 py-2.5 text-sm text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="support-email"
                          className="block text-xs font-bold text-[#1F1F1C] mb-1"
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
                          className="w-full rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] px-3.5 py-2.5 text-right text-sm text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label
                          htmlFor="support-message"
                          className="block text-xs font-bold text-[#1F1F1C] mb-1"
                        >
                          موضوع الطلب أو اسم المشجرة
                        </label>
                        <textarea
                          id="support-message"
                          rows={3}
                          value={supportMessage}
                          onChange={(e) => setSupportMessage(e.target.value)}
                          placeholder="اكتب استفسارك أو نبذة عن الوثائق المتوفرة لدى عائلتك..."
                          className="w-full rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] px-3.5 py-2.5 text-sm text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                        />
                      </div>
                      {supportError && (
                        <p className="sm:col-span-2 text-xs text-[#D97757] font-bold">
                          {supportError}
                        </p>
                      )}
                      <div className="sm:col-span-2 flex justify-end">
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-sm font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
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
      <footer className="border-t border-[#D8C7B2] bg-[#E8DED2]/70 py-12">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <JuthoriLogo
              size="sm"
              onClick={() => navigatePublicPage('home')}
            />

            <nav
              aria-label="روابط التذييل"
              className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs sm:text-sm font-display font-bold text-[#1F1F1C]/80"
            >
              {PUBLIC_NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigatePublicPage(item.id)}
                  className={`transition-colors whitespace-nowrap cursor-pointer ${
                    activePublicPage === item.id
                      ? 'text-[#D97757]'
                      : 'hover:text-[#D97757]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <p className="text-sm sm:text-base font-display font-bold text-[#1F1F1C] pt-1">
              ما لا يُوثق اليوم… قد يصبح مجرد رواية غامضة غدًا.
            </p>

            <p className="text-xs sm:text-sm text-[#1F1F1C]/80 leading-relaxed font-sans">
              تعمل المنصة من خلال شركة جينيا لاب - الولايات المتحدة الأمريكية.
            </p>

            <p
              className="text-xs sm:text-sm text-[#1F1F1C]/75 font-sans"
              dir="rtl"
            >
              منصة الأنساب والإرث العائلي العربي — juthori.com
            </p>

            <p className="text-xs text-[#1F1F1C]/70 font-sans" dir="rtl">
              جميع الحقوق محفوظة. جذوري © 2026
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};