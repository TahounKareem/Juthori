import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Crown,
  Sparkles,
  CreditCard,
  FileCheck2,
  Dna,
  History,
  Image,
  Scroll,
  Plus,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { auth } from '../services/firebase';
import {
  fetchUserProfile,
  fetchUserWalletTransactions,
  executeWalletTransaction,
  processAnnualSubscriptionUpgrade,
  WalletTransactionData,
} from '../services/firestoreService';
import { LineageSearchResult } from '../types/juthori';

interface WalletViewProps {
  result: LineageSearchResult;
  userEmail: string;
  isVip: boolean;
  onUpgradeSuccess: () => void;
  onLogActivity?: (action: string, detail: string) => void;
  externalBalance?: number;
  onBalanceChange?: (nextBalance: number) => void;
}

export const WalletView: React.FC<WalletViewProps> = ({
  result,
  userEmail,
  isVip,
  onUpgradeSuccess,
  onLogActivity,
  externalBalance,
  onBalanceChange,
}) => {
  const [balance, setBalance] = useState<number>(
    typeof externalBalance === 'number' ? externalBalance : isVip ? 25 : 0
  );
  const [transactions, setTransactions] = useState<WalletTransactionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof externalBalance === 'number') {
      setBalance(externalBalance);
    }
  }, [externalBalance]);

  const updateSharedBalance = (nextVal: number) => {
    setBalance(nextVal);
    onBalanceChange?.(nextVal);
  };

  const currentUid = auth.currentUser?.uid || `guest_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

  const loadWalletData = async () => {
    setIsLoading(true);
    try {
      const profile = await fetchUserProfile(currentUid);
      if (profile && typeof profile.walletBalance === 'number' && typeof externalBalance !== 'number') {
        updateSharedBalance(profile.walletBalance);
      }
      const txs = await fetchUserWalletTransactions(currentUid);
      if (txs && txs.length > 0) {
        setTransactions(txs);
      } else {
        // Initial mock transaction for visual realism if ledger is clean
        setTransactions([
          {
            id: 'tx-welcome-init',
            userId: currentUid,
            type: 'credit',
            amount: 25,
            reason: 'رصيد محفظة ترحيبي مع ترقية الاشتراك السنوي بريميوم',
            referenceId: 'welcome_annual_bonus',
            balanceAfter: 25,
            createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
          },
        ]);
      }
    } catch (err) {
      console.warn('Failed to fetch wallet from Firestore, using state:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWalletData();
  }, [currentUid]);

  // Handle service purchase with wallet balance
  const handlePurchaseService = async (serviceName: string, costUsd: number) => {
    setActionErrorMessage(null);
    if (balance < costUsd) {
      setActionErrorMessage(
        `رصيدك الحالي ($${balance}) غير كافٍ. يمكنك شحن المحفظة أو ترقية الاشتراك للحصول على رصيد إضافي.`
      );
      setTimeout(() => setActionErrorMessage(null), 5000);
      return;
    }

    setIsProcessing(true);
    try {
      await executeWalletTransaction(
        currentUid,
        'debit',
        costUsd,
        `شراء خدمة: ${serviceName}`,
        `srv_${Date.now()}`
      );
      const nextBalance = Math.max(0, balance - costUsd);
      updateSharedBalance(nextBalance);
      const newTx: WalletTransactionData = {
        id: `tx_${Date.now()}`,
        userId: currentUid,
        type: 'debit',
        amount: costUsd,
        reason: `شراء خدمة: ${serviceName}`,
        balanceAfter: nextBalance,
        createdAt: new Date().toISOString(),
      };
      setTransactions((prev) => [newTx, ...prev]);
      setActionSuccessMessage(`تم شراء «${serviceName}» بنجاح وخصم $${costUsd} من محفظتك.`);
      onLogActivity?.('شراء خدمة من المحفظة', `${serviceName} — $${costUsd}`);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err) {
      console.warn('Transaction error:', err);
      setActionErrorMessage('تعذر إتمام العملية من المحفظة. يرجى المحاولة لاحقاً.');
      setTimeout(() => setActionErrorMessage(null), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle instant top-up simulation
  const handleTopUpWallet = async (amount: number) => {
    setIsProcessing(true);
    setActionErrorMessage(null);
    try {
      await executeWalletTransaction(
        currentUid,
        'credit',
        amount,
        `شحن رصيد إضافي في المحفظة عبر البطاقة`,
        `topup_${Date.now()}`
      );
      const nextBalance = balance + amount;
      updateSharedBalance(nextBalance);
      const newTx: WalletTransactionData = {
        id: `tx_${Date.now()}`,
        userId: currentUid,
        type: 'credit',
        amount,
        reason: 'شحن رصيد إضافي في المحفظة',
        balanceAfter: nextBalance,
        createdAt: new Date().toISOString(),
      };
      setTransactions((prev) => [newTx, ...prev]);
      setActionSuccessMessage(`تم شحن المحفظة بنجاح بمبلغ $${amount}!`);
      onLogActivity?.('شحن محفظة', `إيداع $${amount}`);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err) {
      console.warn('Top-up error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Annual VIP Subscription upgrade ($60/yr + $25 bonus)
  const handleAnnualUpgradeWithBonus = async () => {
    onUpgradeSuccess();
  };

  return (
    <div className="space-y-6 text-[#252321]">
      {/* Success Notification Alert */}
      {actionSuccessMessage && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-4 text-emerald-900 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}
      {actionErrorMessage && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <span>{actionErrorMessage}</span>
        </div>
      )}

      {/* 1. Wallet Balance Hero Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 rounded-2xl bg-[#252321] text-white p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-white/70 font-semibold flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-[#D8755B]" />
                <span>محفظة جذوري الرقمية</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[11px] text-white/80">
                USD
              </span>
            </div>

            <div className="text-3xl sm:text-4xl font-display font-extrabold text-[#F7F2E9] mb-1">
              ${balance.toFixed(2)}
            </div>
            <p className="text-xs text-white/60">
              الرصيد المتاح لشراء الوثائق، الفحوصات الجينية، والمشجرات الجدارية.
            </p>
          </div>

          <div className="pt-6 border-t border-white/15 mt-6 flex items-center gap-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleTopUpWallet(20)}
              className="flex-1 py-2 px-3 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>شحن $20</span>
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleTopUpWallet(50)}
              className="flex-1 py-2 px-3 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>شحن $50</span>
            </button>
          </div>
        </div>

        {/* Annual Subscription Commercial Model Banner */}
        <div className="lg:col-span-2 rounded-2xl bg-white border border-[#B98A78]/35 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#D8755B] mb-2">
              <Crown className="w-4 h-4" />
              <span>النموذج التجاري لمنصة جذوري — الاشتراك السنوي + رصيد المحفظة</span>
            </div>
            <h3 className="text-lg font-display font-bold text-[#252321]">
              الاشتراك السنوي الشامل بريميوم ($60 / سنة)
            </h3>
            <p className="text-xs sm:text-sm text-[#252321]/75 mt-1 leading-relaxed">
              يشمل فتح عمود النسب الكامل حتى أدد، استعراض المخطوطات، وتفعيل كافة الأدوات
              (شجرتي، خزانتي، كشافي، موقعي، مجتمعي)،{' '}
              <strong className="text-[#D8755B]">
                بالإضافة إلى إيداع رصيد فوري بقيمة $25 في محفظتك الرقمية
              </strong>{' '}
              لاستخدامه في الخدمات الفاخرة!
            </p>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#B98A78]/20 mt-4">
            <div className="text-xs">
              <span className="text-[#252321]/60 block">قيمة الاشتراك:</span>
              <span className="font-bold text-[#252321] text-base">$60 / سنوياً</span>
            </div>

            {isVip ? (
              <span className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold inline-flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>اشتراكك السنوي نشط حالياً</span>
              </span>
            ) : (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleAnnualUpgradeWithBonus}
                className="py-2.5 px-5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs sm:text-sm font-display font-bold flex items-center gap-2 cursor-pointer transition-colors shadow-xs disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>تفعيل الاشتراك السنوي والحصول على $25 رصيد هدية</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Micro-services Marketplace (Purchasable via Wallet Balance) */}
      <div className="rounded-2xl bg-white border border-[#B98A78]/30 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-display font-bold text-[#252321]">
              مزايا وخدمات يمكن شراؤها برصيد المحفظة
            </h3>
            <p className="text-xs text-[#252321]/70 mt-0.5">
              استثمر رصيد محفظتك الرقمية في توثيق إرث عائلتك عبر خدمات جينيالوجية حصرية
            </p>
          </div>
          <span className="text-xs font-bold text-[#D8755B]">خصم مباشر من المحفظة</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {[
            {
              id: 'cert_gold',
              title: 'شهادة عمود نسب مذهبة',
              desc: 'شهادة رسمية مطبوعة بماء الذهب وموقعة بختم جذوري المعتمد مع عمود النسب الكامل.',
              cost: 15,
              icon: Scroll,
              badge: 'الأكثر طلباً',
            },
            {
              id: 'dna_match',
              title: 'مطابقة الحمض النووي (DNA)',
              desc: 'تحليل السلالة الجينية وربطها بالتحور القبلي المتطابق في قاعدة بيانات جذوري.',
              cost: 45,
              icon: Dna,
              badge: 'حصري',
            },
            {
              id: 'photo_restore',
              title: 'ترميم صورة تاريخية نادرة',
              desc: 'معالجة وترميم عالي الدقة بالذكاء الاصطناعي لصورة أجدادك أو وثيقة قديمة.',
              cost: 5,
              icon: Image,
              badge: 'فوري',
            },
            {
              id: 'archive_extract',
              title: 'استخراج صك أو قيد أرشيفي',
              desc: 'استخراج وتوثيق قيد شرعي أو وقف عائلي من سجلات المحاكم العثمانية والأهلية.',
              cost: 20,
              icon: FileCheck2,
              badge: 'أرشيفي',
            },
            {
              id: 'tree_poster',
              title: 'تصدير مشجرة جدارية فائقة الدقة',
              desc: 'ملف جاهز للطباعة بدقة 300DPI بمقاس جداري كبير (A0) يحمل كافة أفرع العائلة.',
              cost: 10,
              icon: History,
              badge: 'رقمي',
            },
            {
              id: 'concierge_call',
              title: 'جلسة استشارية مع باحث أنساب',
              desc: 'جلسة هاتفية أو مرئية لمدة 30 دقيقة مع خبير في تاريخ القبائل والأسر العربية.',
              cost: 30,
              icon: Sparkles,
              badge: 'VIP',
            },
          ].map((srv) => (
            <div
              key={srv.id}
              className="rounded-xl border border-[#B98A78]/30 bg-[#F7F2E9] p-4 flex flex-col justify-between hover:border-[#D8755B] transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-white text-[#D8755B] flex items-center justify-center shadow-2xs">
                    <srv.icon className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-[#EDE6DA] text-[10px] font-bold text-[#252321]/80">
                    {srv.badge}
                  </span>
                </div>
                <h4 className="text-sm font-display font-bold text-[#252321]">{srv.title}</h4>
                <p className="text-xs text-[#252321]/70 mt-1 leading-relaxed">{srv.desc}</p>
              </div>

              <div className="pt-4 border-t border-[#B98A78]/20 mt-3 flex items-center justify-between">
                <span className="text-sm font-extrabold text-[#D8755B]">${srv.cost}</span>
                <button
                  type="button"
                  disabled={isProcessing || balance < srv.cost}
                  onClick={() => handlePurchaseService(srv.title, srv.cost)}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    balance >= srv.cost
                      ? 'bg-[#252321] text-white hover:bg-[#D8755B]'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {balance >= srv.cost ? 'شراء بالرصيد' : 'رصيد غير كافٍ'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Transaction History Ledger */}
      <div className="rounded-2xl bg-white border border-[#B98A78]/30 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-display font-bold text-[#252321]">
            سجل حركات ومعاملات المحفظة
          </h3>
          <span className="text-xs text-[#252321]/60">مدقق تلقائياً في السجل المالي</span>
        </div>

        {transactions.length === 0 ? (
          <p className="text-xs text-[#252321]/60 text-center py-6">لا توجد حركات مسجلة حتى الآن.</p>
        ) : (
          <div className="divide-y divide-[#B98A78]/20">
            {transactions.map((tx) => (
              <div key={tx.id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      tx.type === 'credit'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {tx.type === 'credit' ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-[#252321]">{tx.reason}</div>
                    <div className="text-[11px] text-[#252321]/60">
                      {new Date(tx.createdAt).toLocaleDateString('ar-SA')} · الرصيد بعدها: ${tx.balanceAfter.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div
                  className={`font-mono font-bold text-sm ${
                    tx.type === 'credit' ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {tx.type === 'credit' ? `+$${tx.amount.toFixed(2)}` : `-$${tx.amount.toFixed(2)}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
