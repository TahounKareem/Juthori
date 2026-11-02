import React, { useState, useEffect } from 'react';
import {
  Activity,
  Bell,
  CheckCircle2,
  Crown,
  FileSignature,
  Globe,
  HelpCircle,
  Lock,
  ShoppingCart,
  User,
  X,
  ArrowRight,
  Mail,
  LogOut,
} from 'lucide-react';
import {
  AccountLegalType,
  ActivityLogEntry,
  AncestorCapsule,
  CartItem,
  CheckoutOrderRequest,
  DashboardStateMode,
  DashboardTab,
  LineageSearchResult,
  NotificationItem,
  SilentGeoMetadata,
} from '../types/juthori';
import {
  AL_MUQIT_8_CAPSULES,
  getDashboardCapabilities,
} from '../utils/lineageEngine';
import { LineageSpineColumn } from './LineageSpineColumn';
import { PremiumTabViews } from './PremiumTabViews';
import { WalletView } from './WalletView';
import { JuthoriLogo } from './JuthoriLogo';
import { CheckoutModal } from './CheckoutModal';

interface CustomerDashboardProps {
  stateMode: DashboardStateMode;
  onChangeStateMode: (nextMode: DashboardStateMode) => void;
  accountType: AccountLegalType;
  onUpgradeAccountToRecordKeeper: () => void;
  onToggleAccountTypeForTest: (type: AccountLegalType) => void;
  result: LineageSearchResult;
  silentGeo: SilentGeoMetadata;
  userEmail: string;
  onBackToLanding: () => void;
  onLogout?: () => void;
  onUpdateImmediateParents?: (fatherName: string, grandfatherName: string) => void;
}

const DASHBOARD_TABS: Array<{
  id: DashboardTab;
  label: string;
  premium: boolean;
}> = [
  { id: DashboardTab.Home, label: 'الرئيسية', premium: false },
  { id: DashboardTab.Lineage, label: 'عمود نسبي', premium: false },
  { id: DashboardTab.MyTree, label: 'شجرتي', premium: true },
  { id: DashboardTab.MyVault, label: 'خزانتي', premium: true },
  { id: DashboardTab.MyExplorer, label: 'كشافي', premium: true },
  { id: DashboardTab.MySite, label: 'موقعي', premium: true },
  { id: DashboardTab.MyCommunity, label: 'مجتمعي', premium: true },
];

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  stateMode,
  onChangeStateMode,
  accountType,
  onUpgradeAccountToRecordKeeper,
  result,
  silentGeo,
  userEmail,
  onBackToLanding,
  onLogout,
  onUpdateImmediateParents,
}) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.Lineage);
  const [bridgedAncestors, setBridgedAncestors] = useState<string[]>([]);
  const [bilingualLabels, setBilingualLabels] = useState(false);

  // Wallet Balance & Unlocked Capsules (Stage 4 of Adam Tree)
  const [walletBalance, setWalletBalance] = useState<number>(
    stateMode === DashboardStateMode.AnnualVip ? 25 : 0
  );
  const [unlockedCapsules, setUnlockedCapsules] = useState<string[]>([]);
  const [activeCheckoutOrder, setActiveCheckoutOrder] =
    useState<CheckoutOrderRequest | null>(null);

  // Modals & Exclusive Utility Pages
  const [showCharterModal, setShowCharterModal] = useState(false);
  const [lockedTabPromptName, setLockedTabPromptName] = useState<string | null>(null);
  const [activeUtilityDrawer, setActiveUtilityDrawer] = useState<
    'profile' | 'cart' | 'notifications' | 'activity' | 'help' | null
  >(null);

  // Mandatory Global Scroll-to-Top on any tab or utility page change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeTab, activeUtilityDrawer]);

  // Email verification OTP banner state (shows at top until user confirms email)
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && userEmail) {
      return localStorage.getItem(`juthori_verified_${userEmail}`) === 'true';
    }
    return false;
  });
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [verificationSuccessMessage, setVerificationSuccessMessage] = useState(false);

  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([
    {
      id: 'act-init-1',
      action: 'فحص أولي في محرك الأنساب',
      detail: `البحث عن عمود نسب ${result.clientName} (${result.familyName}) — ${result.originCountry}`,
      timestamp: 'اليوم · قبل دقيقة',
    },
  ]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif-1',
      title: 'تم رصد عقدة مطابقة لعائلتك',
      body: `وجدنا ارتباطاً موثقاً لـ ${result.familyName}. افتح الجذر بـ $5 أو رقِّ لبريميوم لفتح العمود الكامل.`,
      timestamp: 'الآن',
      unread: true,
      actionType: 'unlock_5',
    },
    {
      id: 'notif-2',
      title: 'مزايا الاشتراك السنوي (بريميوم)',
      body: 'ارفع الأقفال الحمراء عن المحطات المرمّزة في شجرة آدم وفعّل شجرتي وخزانتي وكشافي وموقعي ومجتمعي.',
      timestamp: 'منذ دقيقتين',
      unread: true,
      actionType: 'upgrade_vip',
    },
  ]);

  const caps = getDashboardCapabilities(stateMode, accountType);

  const appendActivity = (action: string, detail: string) => {
    setActivityLog((prev) => [
      {
        id: `act-${Date.now()}`,
        action,
        detail,
        timestamp: 'الآن',
      },
      ...prev,
    ]);
  };

  // Opens 3-Step Realistic Checkout Modal for $5 Root Unlock
  const handleUnlockRoot5Usd = () => {
    setActiveCheckoutOrder({
      id: 'ord-root-5',
      type: 'unlock_root_5',
      title: 'فتح نقطة الربط (الجذر) — الباقة الأساسية',
      subtitle: `يكشف الفرع الجامع (${result.rootBranchName}) والقبيلة الأم (${result.rootTribeName}) في السجل الموثق`,
      amountUsd: 5,
      allowWalletPayment: true,
    });
  };

  // Opens 3-Step Realistic Checkout Modal for $60 Annual Premium VIP
  const handleUpgradeAnnualVip = () => {
    setLockedTabPromptName(null);
    setActiveCheckoutOrder({
      id: 'ord-vip-60',
      type: 'upgrade_vip_60',
      title: 'الاشتراك السنوي الشامل — عضوية بريميوم (VIP)',
      subtitle:
        'يفتح المحطات الرئيسية الموثقة حتى آدم عليه السلام + التبويبات الخمسة + $25 رصيد هدية في محفظتك',
      amountUsd: 60,
      allowWalletPayment: false,
      bonusWalletUsd: 25,
    });
  };

  // Opens 3-Step Realistic Checkout Modal for a Single Intermediate Ancestor Ring ($2 - $4)
  const handleRequestUnlockCapsule = (capsule: AncestorCapsule) => {
    setActiveCheckoutOrder({
      id: `ord-${capsule.id}`,
      type: 'unlock_capsule',
      capsuleId: capsule.id,
      title: `فتح ${capsule.title} (${capsule.ancestors.length} أجداد وسيطين)`,
      subtitle: `${capsule.betweenLabel} — تفكيك الوصلات وتحويلها إلى «بن (سليل مباشر)»`,
      amountUsd: capsule.priceUsd,
      allowWalletPayment: true,
    });
  };

  // Opens 3-Step Realistic Checkout Modal for All Intermediate Rings Bundle ($12)
  const handleRequestUnlockAllCapsulesBundle = () => {
    setActiveCheckoutOrder({
      id: 'ord-all-capsules-12',
      type: 'unlock_all_capsules_12',
      title: 'باقة فتح جميع حلقات الأجداد الوسيطين دفعة واحدة',
      subtitle: `فتح كامل سلسلة الأجداد الفرعيين لعائلة ${result.familyName} حتى آدم عليه السلام بسلسلة نسب متصلة بالكامل`,
      amountUsd: 12,
      allowWalletPayment: true,
    });
  };

  // Reset unlocked capsules when switching families so intermediate rings start folded
  useEffect(() => {
    setUnlockedCapsules([]);
  }, [result.familyName]);

  // Callback executed after Step 3 of CheckoutModal completes
  const handleConfirmCheckoutSuccess = (
    order: CheckoutOrderRequest,
    paymentMethod: 'wallet' | 'mada' | 'card' | 'apple_pay',
    invoiceNumber: string
  ) => {
    if (paymentMethod === 'wallet') {
      setWalletBalance((prev) => Math.max(0, prev - order.amountUsd));
    }

    if (order.type === 'unlock_root_5') {
      onChangeStateMode(DashboardStateMode.State1Paid5Basic);
      appendActivity(
        `سداد ناجح (${invoiceNumber}) — فتح الجذر ($5)`,
        `تم الكشف عن الفرع الجامع (${result.rootBranchName}) والقبيلة الأم (${result.rootTribeName})`
      );
    } else if (order.type === 'upgrade_vip_60') {
      onChangeStateMode(DashboardStateMode.AnnualVip);
      setWalletBalance((prev) => prev + (order.bonusWalletUsd ?? 25));
      appendActivity(
        `سداد ناجح (${invoiceNumber}) — عضوية بريميوم السنوية ($60)`,
        'فتح المحطات الرئيسية في شجرة آدم والمصادر وتفعيل التبويبات الخمسة + إيداع $25 رصيد هدية في المحفظة'
      );
    } else if (order.type === 'unlock_capsule' && order.capsuleId) {
      setUnlockedCapsules((prev) =>
        prev.includes(order.capsuleId!) ? prev : [...prev, order.capsuleId!]
      );
      appendActivity(
        `سداد ناجح (${invoiceNumber}) — ${order.title}`,
        `تم فتح حلقة الأجداد الوسيطين بالخصم من ${paymentMethod === 'wallet' ? 'المحفظة الرقمية' : 'البطاقة البنكية'}`
      );
    } else if (order.type === 'unlock_all_capsules_12') {
      const allIds = (result.capsules?.length ? result.capsules : AL_MUQIT_8_CAPSULES).map(
        (c) => c.id
      );
      setUnlockedCapsules(allIds);
      appendActivity(
        `سداد ناجح (${invoiceNumber}) — فتح حلقات الأجداد الوسيطين كاملة ($12)`,
        'تم فتح جميع حلقات الأجداد الوسيطين في شجرة آدم وتحويل كافة الروابط إلى «بن (سليل مباشر)»'
      );
    }

    setActiveCheckoutOrder(null);
    setActiveUtilityDrawer(null);
    setActiveTab(DashboardTab.Lineage);
  };

  const handleTabClick = (tab: (typeof DASHBOARD_TABS)[number]) => {
    if (tab.id === DashboardTab.Home) {
      setActiveUtilityDrawer(null);
      onBackToLanding();
      return;
    }

    if (tab.premium && !caps.arePremiumTabsUnlocked) {
      setLockedTabPromptName(tab.label);
      return;
    }

    setActiveUtilityDrawer(null);
    setActiveTab(tab.id);
  };

  const handleSignCharterAndOpenTree = () => {
    onUpgradeAccountToRecordKeeper();
    setShowCharterModal(false);
    setActiveUtilityDrawer(null);
    setActiveTab(DashboardTab.MyTree);
    appendActivity(
      'التوقيع الإلكتروني على ميثاق أمين السجل',
      'ترقية الصفة القانونية مجاناً من (فرد) إلى (رب أسرة - أمين السجل)'
    );
  };

  const handleVerifyEmailOtp = (codeToVerify?: string) => {
    const code = (codeToVerify ?? otpInput).trim();
    if (!code || code.length < 4) {
      setOtpError('يرجى إدخال رمز التحقق المكون من 4 أرقام');
      return;
    }
    setIsVerifyingOtp(true);
    setOtpError('');
    setTimeout(() => {
      setIsVerifyingOtp(false);
      setVerificationSuccessMessage(true);
      if (typeof window !== 'undefined' && userEmail) {
        localStorage.setItem(`juthori_verified_${userEmail}`, 'true');
      }
      setTimeout(() => {
        setIsEmailVerified(true);
        appendActivity('توثيق البريد الإلكتروني', `تم التحقق بنجاح من البريد (${userEmail || 'المستخدم'})`);
      }, 900);
    }, 500);
  };

  const availableCartItems: CartItem[] = [];
  if (!caps.isRootUnlocked && stateMode === DashboardStateMode.State2MatchedUnpaid) {
    availableCartItems.push({
      id: 'root_5_usd',
      title: 'فتح نقطة الربط بالجذر (دفعة لمرة واحدة)',
      subtitle: 'يكشف الفرع الجامع (آل برمان) والقبيلة الأم (بني بشر) لعائلتك',
      priceUsd: 5,
      billingLabel: 'لمرة واحدة',
    });
  }
  if (!caps.isVip) {
    availableCartItems.push({
      id: 'vip_annual_60_usd',
      title: 'الاشتراك السنوي الشامل — بريميوم (VIP)',
      subtitle:
        'يفتح المحطات المرمّزة الـ 14 في شجرة آدم والمصادر + التبويبات الخمسة + $25 رصيد محفظة',
      priceUsd: 60,
      billingLabel: 'سنوياً',
    });
  }

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div dir="rtl" className="min-h-screen bg-[#F7F2E9] text-[#252321] overflow-x-hidden">
      {/* 0. Top Email Verification Banner (disappears once email is verified) */}
      {!isEmailVerified && (
        <aside
          aria-label="شريط توثيق الحساب"
          className="bg-[#FAF3EA] border-b-2 border-[#D8755B] px-4 py-3 text-[#252321] transition-all relative z-40"
        >
          <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
            {/* Right: Notification copy */}
            <div className="flex items-center gap-3 text-right w-full md:w-auto">
              <div className="w-8 h-8 rounded-xl bg-[#D8755B]/15 text-[#D8755B] flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <p className="font-bold text-[#252321]">
                  أو إرسال رمز تحقق (OTP - 4 أرقام) عبر البريد لتوثيق الحساب
                </p>
                <p className="text-[11px] text-[#252321]/70">
                  يرجى تأكيد بريدك الإلكتروني {userEmail ? <strong className="text-[#D8755B]" dir="ltr">({userEmail})</strong> : ''} لتوثيق ملكية السجل واستلام إشعارات التحديثات.
                </p>
              </div>
            </div>

            {/* Left: Verification code form */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
              {verificationSuccessMessage ? (
                <div className="flex items-center gap-1.5 text-[#8D4925] bg-[#EDE6DA] border border-[#D8755B]/45 px-3.5 py-1.5 rounded-xl font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-[#D8755B]" />
                  <span>تم توثيق البريد بنجاح! جاري إخفاء هذا الشريط...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      dir="ltr"
                      value={otpInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setOtpInput(val);
                        if (otpError) setOtpError('');
                      }}
                      placeholder="7421"
                      aria-label="رمز التحقق OTP المكون من 4 أرقام"
                      className="w-20 sm:w-24 px-2.5 py-1.5 rounded-xl bg-white border border-[#B98A78]/60 text-center font-mono font-bold tracking-widest text-[#252321] text-xs sm:text-sm focus:outline-none focus:border-[#D8755B]"
                    />
                    <button
                      type="button"
                      disabled={isVerifyingOtp}
                      onClick={() => handleVerifyEmailOtp()}
                      className="px-3 py-1.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                    >
                      {isVerifyingOtp ? 'جاري التحقق...' : 'تأكيد الرمز'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setOtpInput('7421');
                      handleVerifyEmailOtp('7421');
                    }}
                    className="text-[11px] text-[#D8755B] hover:underline font-bold border border-[#D8755B]/40 rounded-xl px-2.5 py-1.5 bg-white transition-colors cursor-pointer"
                  >
                    تعبئة وتأكيد فوري (7421)
                  </button>

                  {otpError && (
                    <span className="text-red-700 text-[11px] font-bold block w-full text-right sm:w-auto">
                      {otpError}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* A. DASHBOARD TOP HEADER & NAVIGATION BAR */}
      <header className="bg-white border-b border-[#B98A78]/35 lg:sticky lg:top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          {/* Top Utility Bar */}
          <div className="py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/20">
            {/* Right: Circular Profile Avatar + Luxury Welcome Area + Status Badge + Role Badge */}
            <div className="flex items-center gap-3.5">
              <JuthoriLogo size="sm" onClick={onBackToLanding} />

              <div className="h-7 w-px bg-[#B98A78]/30 hidden sm:block" />

              <button
                type="button"
                onClick={() =>
                  setActiveUtilityDrawer((cur) =>
                    cur === 'profile' ? null : 'profile'
                  )
                }
                aria-label="إعدادات البروفايل"
                className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors cursor-pointer text-right ${
                  activeUtilityDrawer === 'profile'
                    ? 'bg-[#EDE6DA] ring-1 ring-[#D8755B]/50'
                    : 'hover:bg-[#F7F2E9]'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-[#252321] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <User className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  {/* Line 1: Welcome Name + Membership Status Badge */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm sm:text-base font-display font-bold text-[#252321]">
                      مرحباً، {result.clientName} {result.familyName}
                    </span>
                    {caps.isVip ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-gradient-to-l from-[#D8755B] to-[#8D4925] text-white text-[11px] font-display font-bold shadow-2xs">
                        <span>👑 عضوية بريميوم السنوية</span>
                      </span>
                    ) : caps.isRootUnlocked ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#D8755B]/15 text-[#D8755B] border border-[#D8755B]/35 text-[11px] font-display font-bold">
                        <span>✨ الباقة الأساسية ($5)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#EDE6DA] text-[#252321]/80 border border-[#B98A78]/35 text-[11px] font-display font-semibold">
                        <span>حساب مجاني</span>
                      </span>
                    )}
                  </div>

                  {/* Line 2: Family Record Title + Legal Role Badge + Current Wallet Balance */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-[#252321]/75">
                      سجل عائلة {result.familyName}
                    </span>

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F7F2E9] text-[#252321] border border-[#B98A78]/40 text-[11px] font-display font-semibold">
                      <span>
                        {accountType === AccountLegalType.RecordKeeper
                          ? '🏛️ أمين السجل - رب أسرة'
                          : '👤 عضو فرد'}
                      </span>
                    </span>

                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveUtilityDrawer('cart');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          setActiveUtilityDrawer('cart');
                        }
                      }}
                      title="عرض المحفظة الرقمية وشحن الرصيد"
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#252321] hover:bg-[#D8755B] text-[#F7F2E9] text-[11px] font-display font-bold tabular-nums transition-colors cursor-pointer"
                    >
                      <span>💳 المحفظة: ${walletBalance} (شحن +)</span>
                    </span>
                  </div>
                </div>
              </button>
            </div>

            {/* Center-Left Simplified Icon-Only Utility Bar */}
            <div className="flex items-center gap-2">

              <button
                type="button"
                onClick={() =>
                  setActiveUtilityDrawer((cur) => (cur === 'cart' ? null : 'cart'))
                }
                title="سلة المشتريات والمحفظة الرقمية"
                aria-label="سلة المشتريات والمحفظة الرقمية"
                className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                  activeUtilityDrawer === 'cart'
                    ? 'bg-[#D8755B] text-white shadow-xs'
                    : 'bg-[#F7F2E9] hover:bg-[#EDE6DA] text-[#252321]'
                }`}
              >
                <ShoppingCart
                  className={`w-4 h-4 ${
                    activeUtilityDrawer === 'cart' ? 'text-white' : 'text-[#D8755B]'
                  }`}
                  aria-hidden="true"
                />
                {availableCartItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#252321] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {availableCartItems.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveUtilityDrawer((cur) =>
                    cur === 'notifications' ? null : 'notifications'
                  );
                  setNotifications((prev) =>
                    prev.map((n) => ({ ...n, unread: false }))
                  );
                }}
                title="الإشعارات"
                aria-label="الإشعارات"
                className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                  activeUtilityDrawer === 'notifications'
                    ? 'bg-[#D8755B] text-white shadow-xs'
                    : 'bg-[#F7F2E9] hover:bg-[#EDE6DA] text-[#252321]'
                }`}
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveUtilityDrawer((cur) =>
                    cur === 'activity' ? null : 'activity'
                  )
                }
                title="نشاط السجل"
                aria-label="نشاط السجل"
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                  activeUtilityDrawer === 'activity'
                    ? 'bg-[#D8755B] text-white shadow-xs'
                    : 'bg-[#F7F2E9] hover:bg-[#EDE6DA] text-[#252321]'
                }`}
              >
                <Activity className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveUtilityDrawer((cur) => (cur === 'help' ? null : 'help'))
                }
                title="المساعدة"
                aria-label="المساعدة"
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                  activeUtilityDrawer === 'help'
                    ? 'bg-[#D8755B] text-white shadow-xs'
                    : 'bg-[#F7F2E9] hover:bg-[#EDE6DA] text-[#252321]'
                }`}
              >
                <HelpCircle className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => setBilingualLabels((v) => !v)}
                title={bilingualLabels ? 'العربية فقط' : 'تبديل اللغة'}
                aria-label={bilingualLabels ? 'العربية فقط' : 'تبديل اللغة'}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                  bilingualLabels
                    ? 'bg-[#252321] text-white'
                    : 'bg-[#F7F2E9] hover:bg-[#EDE6DA] text-[#252321]'
                }`}
              >
                <Globe className="w-4 h-4" aria-hidden="true" />
              </button>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  title="تسجيل الخروج والعودة للصفحة الرئيسية"
                  aria-label="تسجيل الخروج"
                  className="px-3 h-10 rounded-xl bg-[#F7F2E9] hover:bg-red-50 text-[#252321] hover:text-red-700 border border-[#B98A78]/35 hover:border-red-300 text-xs font-display font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">تسجيل الخروج</span>
                </button>
              )}
            </div>
          </div>

          {/* Main Dashboard Navigation Tabs (Smooth Mobile Touch Scroll + Clear Active Indicator) */}
          <nav
            aria-label="تبويبات لوحة تحكم العميل"
            className="flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth touch-pan-x py-2.5 -mx-4 px-4 sm:mx-0 sm:px-0"
          >
            {DASHBOARD_TABS.map((tab) => {
              const isLocked = tab.premium && !caps.arePremiumTabsUnlocked;
              const isSelected = activeUtilityDrawer === null && activeTab === tab.id;

              let buttonClasses =
                'relative px-4 py-2.5 rounded-xl text-xs sm:text-sm font-display font-bold inline-flex items-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] ';

              if (isSelected) {
                buttonClasses +=
                  'bg-[#D8755B] text-white shadow-sm ring-2 ring-[#D8755B]/30';
              } else if (isLocked) {
                buttonClasses +=
                  'bg-[#EDE6DA]/60 text-[#252321]/50 hover:bg-[#EDE6DA]';
              } else {
                buttonClasses += 'text-[#252321] hover:bg-[#EDE6DA]';
              }

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabClick(tab)}
                  title={
                    isLocked
                      ? `تبويب «${tab.label}» متاح لمشتركي الباقة السنوية (بريميوم)`
                      : tab.label
                  }
                  className={buttonClasses}
                >
                  {isSelected && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-[#F3D299] shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span>{tab.label}</span>
                  {isLocked && (
                    <Lock
                      className="w-3.5 h-3.5 text-[#DC2626]/80"
                      aria-label="ميزة بريميوم مقفلة"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* MAIN DASHBOARD WORKSPACE — Full-Page Exclusive Routing Directly Under Header */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeUtilityDrawer !== null ? (
          /* Exclusive Standalone Full Page for Profile / Cart / Notifications / Activity / Help */
          <div className="rounded-2xl bg-white border border-[#B98A78]/45 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#B98A78]/25">
              <div>
                <p className="text-xs font-semibold text-[#D8755B] mb-1">
                  {activeUtilityDrawer === 'profile' && 'إعدادات الحساب والصفحة الشخصية'}
                  {activeUtilityDrawer === 'cart' && 'الترقيات والمحفظة الرقمية'}
                  {activeUtilityDrawer === 'notifications' && 'التنبيهات والتحديثات الأرشيفية'}
                  {activeUtilityDrawer === 'activity' && 'الأرشيف الزمني للعمليات'}
                  {activeUtilityDrawer === 'help' && 'الدعم والإرشاد المعرفي'}
                </p>
                <h1 className="text-xl sm:text-2xl font-display font-bold text-[#252321]">
                  {activeUtilityDrawer === 'profile' && 'إعدادات البروفايل وبيانات الجلسة المسجلة'}
                  {activeUtilityDrawer === 'cart' && 'سلة المشتريات والمحفظة الرقمية'}
                  {activeUtilityDrawer === 'notifications' && 'مركز الإشعارات والتنبيهات النسبية'}
                  {activeUtilityDrawer === 'activity' && 'نشاط السجل والتوثيق الزمني'}
                  {activeUtilityDrawer === 'help' && 'مركز مساعدة لوحة تحكم العميل'}
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setActiveUtilityDrawer(null)}
                className="self-start sm:self-auto px-4 py-2 rounded-xl bg-[#EDE6DA] hover:bg-[#D8755B] hover:text-white text-[#252321] text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
                <span>العودة إلى {DASHBOARD_TABS.find((t) => t.id === activeTab)?.label || 'عمود نسبي'}</span>
              </button>
            </div>

            {activeUtilityDrawer === 'profile' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs sm:text-sm">
                  <div className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-4">
                    <div className="text-[#252321]/65 text-xs">الاسم والعائلة</div>
                    <div className="font-bold text-base mt-1 text-[#252321]">
                      {result.clientName}
                      {result.fatherName && result.fatherName !== '—'
                        ? ` بن ${result.fatherName}`
                        : ''}{' '}
                      {result.familyName}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-4">
                    <div className="text-[#252321]/65 text-xs">البريد الإلكتروني</div>
                    <div className="font-mono text-xs sm:text-sm mt-1 text-[#252321]" dir="ltr">
                      {userEmail}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-4">
                    <div className="text-[#252321]/65 text-xs">الصفة القانونية</div>
                    <div className="font-bold text-[#D8755B] mt-1">
                      {accountType === AccountLegalType.RecordKeeper
                        ? '🏛️ رب أسرة - أمين السجل'
                        : '👤 حساب فرد'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-4">
                    <div className="text-[#252321]/65 text-xs">
                      التقاط الموقع التلقائي الصامت (IP Geo)
                    </div>
                    <div className="font-semibold mt-1 text-[#252321]">
                      {silentGeo.ip_country} — {silentGeo.ip_city}
                    </div>
                  </div>
                </div>

                {onLogout && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={onLogout}
                      className="px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>تسجيل الخروج وإنهاء الجلسة النشطة</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeUtilityDrawer === 'cart' && (
              <div className="space-y-6">
                {/* Top Section of Cart: Premium & Root Activation */}
                <div className="space-y-3">
                  <div className="text-xs font-display font-bold text-[#D8755B] flex items-center gap-1.5">
                    <Crown className="w-4 h-4" />
                    <span>تفعيل باقة بريميوم والترقيات الأساسية</span>
                  </div>
                  {availableCartItems.length === 0 ? (
                    <div className="rounded-xl bg-[#F7F2E9] border border-[#D8755B]/40 p-4 text-sm text-[#252321] font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#D8755B] shrink-0" />
                      <span>أنت مشترك بالفعل في أعلى باقة (👑 عضوية بريميوم) وجميع المزايا مفعّلة في حسابك.</span>
                    </div>
                  ) : (
                    availableCartItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-sm font-display font-bold text-[#252321]">
                            {item.title}
                          </div>
                          <div className="text-xs text-[#252321]/75 mt-0.5">
                            {item.subtitle}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-lg font-display font-bold text-[#252321] tabular-nums">
                            ${item.priceUsd}
                          </span>
                          <button
                            type="button"
                            onClick={
                              item.id === 'root_5_usd'
                                ? handleUnlockRoot5Usd
                                : handleUpgradeAnnualVip
                            }
                            className="px-4 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold cursor-pointer"
                          >
                            إتمام التفعيل الآن
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Bottom Section of Cart: Digital Wallet Content */}
                <div className="pt-5 border-t border-[#B98A78]/30">
                  <WalletView
                    result={result}
                    userEmail={userEmail}
                    isVip={caps.isVip}
                    onUpgradeSuccess={handleUpgradeAnnualVip}
                    onLogActivity={appendActivity}
                    externalBalance={walletBalance}
                    onBalanceChange={setWalletBalance}
                  />
                </div>
              </div>
            )}

            {activeUtilityDrawer === 'notifications' && (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-display font-bold text-[#252321]">
                        {n.title}
                      </div>
                      <div className="text-xs text-[#252321]/75 mt-1">{n.body}</div>
                    </div>
                    {n.actionType === 'unlock_5' && !caps.isRootUnlocked && (
                      <button
                        type="button"
                        onClick={handleUnlockRoot5Usd}
                        className="px-4 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold whitespace-nowrap cursor-pointer"
                      >
                        فتح الجذر ($5)
                      </button>
                    )}
                    {n.actionType === 'upgrade_vip' && !caps.isVip && (
                      <button
                        type="button"
                        onClick={handleUpgradeAnnualVip}
                        className="px-4 py-2 rounded-xl bg-[#252321] hover:bg-[#3a3734] text-white text-xs font-display font-bold whitespace-nowrap cursor-pointer"
                      >
                        ترقية لبريميوم
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeUtilityDrawer === 'activity' && (
              <div className="space-y-2.5">
                {activityLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 px-4 py-3 flex items-center justify-between gap-3 text-xs sm:text-sm"
                  >
                    <div>
                      <strong className="text-[#252321]">{entry.action}:</strong>{' '}
                      <span className="text-[#252321]/80">{entry.detail}</span>
                    </div>
                    <span className="text-[#252321]/60 whitespace-nowrap text-xs">
                      {entry.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activeUtilityDrawer === 'help' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm text-[#252321]/85 leading-relaxed">
                <div className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-4 space-y-1.5">
                  <div className="font-display font-bold text-[#D8755B]">
                    ✨ الباقة الأساسية ($5)
                  </div>
                  <p>
                    تتيح لك معرفة نقطة الربط المباشرة لعائلتك بالفرع القبلي الموثق (B2) والقبيلة الأم (B0) دون التزام باشتراك سنوي.
                  </p>
                </div>
                <div className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-4 space-y-1.5">
                  <div className="font-display font-bold text-[#D8755B]">
                    👑 عضوية بريميوم السنوية
                  </div>
                  <p>
                    تفتح عمود النسب الكامل فوق الجذر مع المصادر والروايات، وتفعّل صفحات (شجرتي، خزانتي، كشافي، موقعي، مجتمعي).
                  </p>
                </div>
                <div className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-4 space-y-1.5">
                  <div className="font-display font-bold text-[#D8755B]">
                    🏛️ ميثاق أمين السجل
                  </div>
                  <p>
                    بناء شجرة العائلة التفصيلية متاح لرب الأسرة الموقع إلكترونياً على ميثاق دقة البيانات العائلية.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === DashboardTab.Lineage ? (
          <LineageSpineColumn
            stateMode={stateMode}
            accountType={accountType}
            result={result}
            bridgedAncestors={bridgedAncestors}
            onAddBridgedAncestor={(name) => {
              setBridgedAncestors((prev) => [...prev, name]);
              appendActivity('إضافة جد وسيط (+ الخامس)', `إضافة «${name}» بين العائلة والجذر`);
            }}
            onUnlockRoot5Usd={handleUnlockRoot5Usd}
            onUpgradeAnnualVip={handleUpgradeAnnualVip}
            unlockedCapsules={unlockedCapsules}
            onRequestUnlockCapsule={handleRequestUnlockCapsule}
            onRequestUnlockAllCapsulesBundle={handleRequestUnlockAllCapsulesBundle}
            walletBalance={walletBalance}
            onUpdateImmediateParents={onUpdateImmediateParents}
            onOpenMyTreeTab={() => {
              const treeTab = DASHBOARD_TABS.find(
                (t) => t.id === DashboardTab.MyTree
              );
              if (treeTab) handleTabClick(treeTab);
            }}
          />
        ) : (
          <PremiumTabViews
            activeTab={activeTab}
            result={result}
            accountType={accountType}
            caps={caps}
            onNavigateTab={(t) => {
              const found = DASHBOARD_TABS.find((x) => x.id === t);
              if (found) handleTabClick(found);
            }}
            onUnlockRoot5Usd={handleUnlockRoot5Usd}
            onUpgradeAnnualVip={handleUpgradeAnnualVip}
            onSignCharterAndEnableTree={handleSignCharterAndOpenTree}
            onLogActivity={appendActivity}
            onSyncImmediateParents={onUpdateImmediateParents}
            unlockedCapsules={unlockedCapsules}
            onRequestUnlockCapsule={handleRequestUnlockCapsule}
            onRequestUnlockAllCapsulesBundle={handleRequestUnlockAllCapsulesBundle}
            walletBalance={walletBalance}
          />
        )}
      </main>

      {/* Quiet Editorial Footer inside Customer Dashboard (Staff Portal hidden here) */}
      <footer className="border-t border-[#B98A78]/30 bg-[#EDE6DA]/70 py-8 mt-12">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#252321]/75">
          <div className="flex items-center gap-3">
            <JuthoriLogo size="sm" onClick={onBackToLanding} />
            <span>جميع الحقوق محفوظة. جذوري © 2026 — juthori.com</span>
          </div>
        </div>
      </footer>

      {/* MODAL 1: Locked Premium Tab Prompt (When clicking any of the 5 greyed-out tabs in Basic Mode) */}
      {lockedTabPromptName && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#252321]/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="locked-tab-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/50 p-6 sm:p-7 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 text-[#DC2626] flex items-center justify-center">
                <Lock className="w-5 h-5" aria-hidden="true" />
              </div>
              <button
                type="button"
                onClick={() => setLockedTabPromptName(null)}
                aria-label="إغلاق"
                className="w-9 h-9 rounded-lg hover:bg-[#EDE6DA] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3
              id="locked-tab-modal-title"
              className="text-lg font-display font-bold text-[#252321]"
            >
              تبويب «{lockedTabPromptName}» ضمن مزايا باقة بريميوم السنوية
            </h3>
            <p className="text-sm text-[#252321]/80 leading-relaxed">
              أنت حالياً على الباقة الأساسية (البيسك). رقِّ حسابك إلى الاشتراك السنوي (بريميوم) لفتح عمود النسب الكامل فوق الجذر وتفعيل خدمات (شجرتي، خزانتي، كشافي، موقعي، مجتمعي).
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleUpgradeAnnualVip}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-sm font-display font-bold cursor-pointer"
              >
                الترقية الآن إلى بريميوم ($60/سنة)
              </button>
              <button
                type="button"
                onClick={() => setLockedTabPromptName(null)}
                className="py-2.5 px-4 rounded-xl bg-[#EDE6DA] text-[#252321] text-sm font-semibold cursor-pointer"
              >
                البقاء في البيسك
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Record Keeper Electronic Charter Modal (Crucial Business Rule when Individual clicks شجرتي in VIP) */}
      {showCharterModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#252321]/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="charter-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#F7F2E9] border border-[#D8755B]/50 p-6 sm:p-8 shadow-xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#D8755B]/15 text-[#D8755B] flex items-center justify-center shrink-0">
                <FileSignature className="w-6 h-6" aria-hidden="true" />
              </div>
              <button
                type="button"
                onClick={() => setShowCharterModal(false)}
                aria-label="إغلاق نافذة ميثاق أمين السجل"
                className="w-9 h-9 rounded-lg hover:bg-[#EDE6DA] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <h3
                id="charter-modal-title"
                className="text-lg sm:text-xl font-display font-bold text-[#252321] leading-snug"
              >
                هذه الميزة مخصصة لـ (رب الأسرة - أمين السجل). هل ترغب في التوقيع الإلكتروني على عقد أمين السجل لترقية صلاحيتك مجاناً؟
              </h3>
              <p className="text-xs sm:text-sm text-[#252321]/80 leading-relaxed">
                حسابك مسجّل حالياً بصفة «حساب فرد». يضمن عقد أمين السجل في منصة جذوري دقة التفرعات الأسرية المضافة ومنع انتحال الصفات العائلية.
              </p>
            </div>

            <div className="rounded-xl bg-[#EDE6DA] border border-[#B98A78]/45 p-4 text-xs text-[#252321]/85 space-y-2 leading-relaxed">
              <div className="font-display font-bold text-[#252321]">
                بنود ميثاق أمين السجل الإلكتروني المختصرة:
              </div>
              <p>1. أقرّ بصحة بيانات الأفراد والفروع الذين أضيفهم في شجرة أسرتي المباشرة على مسؤوليتي القانونية والأدبية.</p>
              <p>2. ألتزم باحترام خصوصية الأحياء وعدم نشر بيانات حساسة دون موافقة أصحابها.</p>
              <p>3. تخضع طلبات ربط الفروع العليا لمراجعة لجنة التحقيق النسبي في منصة جذوري.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                onClick={handleSignCharterAndOpenTree}
                className="flex-1 py-3 px-5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-sm font-display font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>أوقّع إلكترونياً وترقية صلاحيتي مجاناً</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCharterModal(false)}
                className="py-3 px-4 rounded-xl bg-[#EDE6DA] hover:bg-[#e2d8c7] text-[#252321] text-sm font-semibold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Realistic 3-Step Checkout & Wallet Payment Modal */}
      <CheckoutModal
        order={activeCheckoutOrder}
        walletBalance={walletBalance}
        onClose={() => setActiveCheckoutOrder(null)}
        onConfirmSuccess={handleConfirmCheckoutSuccess}
        onQuickTopUpWallet={(amountUsd) => {
          setWalletBalance((prev) => prev + amountUsd);
          appendActivity(
            'شحن فوري للمحفظة الرقمية',
            `إيداع $${amountUsd} عبر بوابة الدفع السريع`
          );
        }}
      />
    </div>
  );
};
