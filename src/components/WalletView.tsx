import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Crown,
  Sparkles,
  FileCheck2,
  Dna,
  History,
  Image,
  Scroll,
  Plus,
  Loader2,
  CheckCircle,
  Copy,
  Check,
  Mail,
  X,
  AlertCircle,
} from 'lucide-react';
import { auth } from '../services/firebase';
import {
  canonicalCustomerEmailUid,
  fetchUserProfile,
  fetchUserWalletTransactions,
  executeAtomicWalletOperation,
  WalletTransactionData,
} from '../services/firestoreService';
import { LineageSearchResult } from '../types/juthori';

interface WalletViewProps {
  result: LineageSearchResult;
  userId?: string;
  userEmail: string;
  isVip: boolean;
  onUpgradeSuccess: () => void;
  onLogActivity?: (action: string, detail: string) => void;
  externalBalance?: number;
  onBalanceChange?: (nextBalance: number) => void;
  highlightedShortfallUsd?: number | null;
  onClearShortfall?: () => void;
  emailVerified?: boolean;
  showEmailReminderBanner?: boolean;
  onDismissEmailReminderBanner?: () => void;
  onOpenEmailVerification?: () => void;
}

export const WalletView: React.FC<WalletViewProps> = ({
  userId,
  userEmail,
  isVip,
  onUpgradeSuccess,
  onLogActivity,
  externalBalance,
  onBalanceChange,
  highlightedShortfallUsd = null,
  onClearShortfall,
  emailVerified = true,
  showEmailReminderBanner = false,
  onDismissEmailReminderBanner,
  onOpenEmailVerification,
}) => {
  const [balance, setBalance] = useState<number>(
    typeof externalBalance === 'number' ? externalBalance : isVip ? 25 : 0
  );
  const [transactions, setTransactions] = useState<WalletTransactionData[]>([]);
  const [, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [localShortfallUsd, setLocalShortfallUsd] = useState<number | null>(null);
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof externalBalance === 'number') {
      setBalance(externalBalance);
    }
  }, [externalBalance]);

  const activeShortfallUsd =
    typeof highlightedShortfallUsd === 'number' && highlightedShortfallUsd > 0
      ? highlightedShortfallUsd
      : typeof localShortfallUsd === 'number' && localShortfallUsd > 0
      ? localShortfallUsd
      : null;

  const updateSharedBalance = (nextVal: number) => {
    setBalance(nextVal);
    onBalanceChange?.(nextVal);
  };

  const currentUid =
    userId ||
    auth.currentUser?.uid ||
    canonicalCustomerEmailUid(userEmail) ||
    `guest_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

  const loadWalletData = async () => {
    setIsLoading(true);
    try {
      const profile = await fetchUserProfile(currentUid);
      const resolvedBalance =
        profile && typeof profile.walletBalance === 'number'
          ? profile.walletBalance
          : typeof externalBalance === 'number'
          ? externalBalance
          : 0;
      if (profile && typeof profile.walletBalance === 'number') {
        updateSharedBalance(profile.walletBalance);
      }
      const txs = await fetchUserWalletTransactions(currentUid);
      if (txs && txs.length > 0) {
        setTransactions(txs);
      } else if (isVip && resolvedBalance > 0) {
        setTransactions([
          {
            id: 'TXN-20260101-BONUS',
            transactionId: 'TXN-20260101-BONUS',
            userId: currentUid,
            userEmail,
            type: 'TOPUP',
            direction: 'credit',
            amount: resolvedBalance,
            balanceBefore: 0,
            balanceAfter: resolvedBalance,
            status: 'COMPLETED',
            descriptionAr: 'رصيد محفظة ترحيبي مع ترقية الاشتراك السنوي بريميوم',
            reason: 'رصيد محفظة ترحيبي مع ترقية الاشتراك السنوي بريميوم',
            referenceId: 'welcome_annual_bonus',
            createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
          },
        ]);
      } else {
        setTransactions([]);
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

  const handleCopyTransactionId = async (txRef: string) => {
    if (!txRef) return;
    try {
      await navigator.clipboard.writeText(txRef);
      setCopiedTxId(txRef);
      setTimeout(() => {
        setCopiedTxId((curr) => (curr === txRef ? null : curr));
      }, 2200);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  // Handle service purchase via Atomic Firestore Transaction (`runTransaction`)
  const handlePurchaseService = async (serviceName: string, costUsd: number) => {
    if (isProcessing) return;
    setActionErrorMessage(null);
    setActionSuccessMessage(null);

    setIsProcessing(true);
    try {
      const res = await executeAtomicWalletOperation({
        userId: currentUid,
        userEmail,
        operationType: 'UNLOCK_CAPSULE',
        amountUsd: costUsd,
        paymentMethod: 'wallet',
        descriptionAr: `شراء خدمة جينيالوجية من المحفظة: ${serviceName}`,
        referenceId: `srv_${Date.now()}`,
        skipFeatureIdempotency: true,
      });

      if (res.status === 'INSUFFICIENT_FUNDS') {
        const shortfall = Number(
          (res.shortfallUsd ?? Math.max(0, costUsd - res.balanceBefore)).toFixed(2)
        );
        updateSharedBalance(res.balanceBefore);
        setLocalShortfallUsd(shortfall);
        setActionErrorMessage(
          `رصيدك الفعلي في المحفظة ($${res.balanceBefore.toFixed(2)}) غير كافٍ لشراء «${serviceName}» ($${costUsd.toFixed(2)}). المبلغ المتبقي لإتمام العملية بدقة: $${shortfall.toFixed(2)}.`
        );
        return;
      }

      const nextBalance = res.balanceAfter;
      updateSharedBalance(nextBalance);
      setLocalShortfallUsd(null);
      onClearShortfall?.();

      const recordedTx: WalletTransactionData = res.transactionRecord || {
        id: res.transactionId || `TXN-${Date.now()}`,
        transactionId: res.transactionId,
        userId: currentUid,
        userEmail,
        type: 'UNLOCK_CAPSULE',
        direction: 'debit',
        amount: costUsd,
        balanceBefore: res.balanceBefore,
        balanceAfter: nextBalance,
        status: 'COMPLETED',
        descriptionAr: `شراء خدمة جينيالوجية من المحفظة: ${serviceName}`,
        reason: `شراء خدمة جينيالوجية من المحفظة: ${serviceName}`,
        createdAt: new Date().toISOString(),
      };

      setTransactions((prev) => [
        recordedTx,
        ...prev.filter((item) => item.id !== recordedTx.id),
      ]);
      setActionSuccessMessage(
        `تم شراء «${serviceName}» بنجاح وخصم $${costUsd.toFixed(2)} ذرياً من محفظتك · المرجع: ${recordedTx.transactionId || recordedTx.id}`
      );
      onLogActivity?.(
        `شراء خدمة من المحفظة (${recordedTx.transactionId || recordedTx.id})`,
        `${serviceName} — $${costUsd.toFixed(2)}`
      );
      setTimeout(() => setActionSuccessMessage(null), 5000);
    } catch (err) {
      console.warn('Transaction error:', err);
      setActionErrorMessage('تعذر إتمام العملية من المحفظة. يرجى المحاولة لاحقاً.');
      setTimeout(() => setActionErrorMessage(null), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle instant atomic top-up via Firestore `runTransaction`
  const handleTopUpWallet = async (amount: number) => {
    if (isProcessing || amount <= 0) return;
    setIsProcessing(true);
    setActionErrorMessage(null);
    setActionSuccessMessage(null);
    try {
      const cleanAmount = Number(amount.toFixed(2));
      const res = await executeAtomicWalletOperation({
        userId: currentUid,
        userEmail,
        operationType: 'TOPUP',
        amountUsd: cleanAmount,
        paymentMethod: 'external',
        descriptionAr: `شحن رصيد إضافي في المحفظة الرقمية (+$${cleanAmount.toFixed(2)})`,
        referenceId: `topup_${Date.now()}`,
      });

      const nextBalance = res.balanceAfter;
      updateSharedBalance(nextBalance);
      setLocalShortfallUsd(null);
      onClearShortfall?.();

      const recordedTx: WalletTransactionData = res.transactionRecord || {
        id: res.transactionId || `TXN-${Date.now()}`,
        transactionId: res.transactionId,
        userId: currentUid,
        userEmail,
        type: 'TOPUP',
        direction: 'credit',
        amount: cleanAmount,
        balanceBefore: res.balanceBefore,
        balanceAfter: nextBalance,
        status: 'COMPLETED',
        descriptionAr: `شحن رصيد إضافي في المحفظة الرقمية (+$${cleanAmount.toFixed(2)})`,
        reason: `شحن رصيد إضافي في المحفظة الرقمية (+$${cleanAmount.toFixed(2)})`,
        createdAt: new Date().toISOString(),
      };

      setTransactions((prev) => [
        recordedTx,
        ...prev.filter((item) => item.id !== recordedTx.id),
      ]);
      setActionSuccessMessage(
        `تم شحن المحفظة بمبلغ $${cleanAmount.toFixed(2)} وحفظ الرصيد الجديد ($${nextBalance.toFixed(2)}) ذرياً · المرجع: ${recordedTx.transactionId || recordedTx.id}`
      );
      onLogActivity?.(
        `شحن محفظة (${recordedTx.transactionId || recordedTx.id})`,
        `إيداع $${cleanAmount.toFixed(2)} — الرصيد بعد الشحن: $${nextBalance.toFixed(2)}`
      );
      setTimeout(() => setActionSuccessMessage(null), 5000);
    } catch (err) {
      console.warn('Top-up error:', err);
      setActionErrorMessage('تعذر إتمام عملية شحن المحفظة حالياً. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Annual VIP Subscription upgrade ($60/yr + $25 bonus)
  const handleAnnualUpgradeWithBonus = async () => {
    onUpgradeSuccess();
  };

  const getStructuredTypeBadgeLabel = (tx: WalletTransactionData): string => {
    switch (tx.type) {
      case 'TOPUP':
        return 'شحن رصيد · TOPUP';
      case 'PURCHASE_ROOT_5USD':
        return 'فتح الجذر · $5';
      case 'UNLOCK_CAPSULE':
        return 'فتح سلسلة / مرجع';
      case 'UPGRADE_ANNUAL_VIP':
        return 'ترقية سنوية VIP';
      case 'UPGRADE_REGISTRAR':
        return 'توثيق أمين السجل';
      default:
        return tx.type === 'credit' ? 'إيداع بالمحفظة' : 'خصم من المحفظة';
    }
  };

  return (
    <div className="space-y-6 text-[#1F1F1C]">
      {/* Thin, Calm, Dismissible Email Verification Reminder Banner (Allowed ONLY in Profile & Wallet) */}
      {showEmailReminderBanner && !emailVerified && (
        <div className="rounded-xl bg-[#F5F1E8] border border-[#D97757]/45 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#1F1F1C]">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#D97757] shrink-0" />
            <span>
              تذكير هادئ: بريدك الإلكتروني (<strong className="font-mono">{userEmail}</strong>) غير موثّق بعد — وثّقه لحماية سجلك المالي وإتاحة النشر العام.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onOpenEmailVerification && (
              <button
                type="button"
                onClick={onOpenEmailVerification}
                className="px-3 py-1 rounded-lg bg-[#1F1F1C] hover:bg-[#D97757] text-[#F5F1E8] text-[11px] font-display font-bold transition-colors cursor-pointer"
              >
                توثيق البريد الآن
              </button>
            )}
            {onDismissEmailReminderBanner && (
              <button
                type="button"
                onClick={onDismissEmailReminderBanner}
                aria-label="إغلاق التذكير"
                className="p-1 rounded-lg hover:bg-[#E8DED2] text-[#1F1F1C]/65 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Exact Shortfall Top-Up Prompt when a transaction detects insufficient wallet balance */}
      {activeShortfallUsd !== null && activeShortfallUsd > 0 && (
        <div
          role="region"
          aria-label="شحن الرصيد المتبقي لإتمام العملية"
          className="rounded-2xl bg-[#F5F1E8] border-2 border-[#D97757] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#D97757]/15 text-[#D97757] flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-display font-extrabold text-[#1F1F1C]">
                شحن المحفظة لاستكمال العملية — المبلغ المتبقي بدقة:{' '}
                <span className="font-mono text-[#D97757]">
                  ${activeShortfallUsd.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-[#1F1F1C]/75 leading-relaxed">
                رصيدك الفعلي الحالي <strong>${balance.toFixed(2)}</strong>. يمكنك شحن المبلغ المتبقي بالضبط أو اختيار باقة شحن فوري لإتمام الشراء بأمان دون أي خصم مزدوج.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleTopUpWallet(activeShortfallUsd)}
              className="px-4 py-2 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>شحن المتبقي (${activeShortfallUsd.toFixed(2)})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLocalShortfallUsd(null);
                onClearShortfall?.();
              }}
              className="px-3 py-2 rounded-xl bg-[#E8DED2] hover:bg-[#D8C7B2]/60 text-[#1F1F1C] text-xs font-bold cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Success Notification Alert */}
      {actionSuccessMessage && (
        <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] p-4 text-[#1F1F1C] text-xs sm:text-sm font-semibold flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-[#D97757] shrink-0" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}
      {actionErrorMessage && (
        <div
          role="alert"
          className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] p-4 text-[#1F1F1C] text-xs sm:text-sm font-semibold flex items-center gap-2"
        >
          <span>{actionErrorMessage}</span>
        </div>
      )}

      {/* 1. Wallet Balance Hero Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 rounded-2xl bg-[#1F1F1C] text-[#F5F1E8] p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-[#F5F1E8]/70 font-semibold flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-[#D97757]" />
                <span>محفظة جذوري الرقمية</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#F5F1E8]/10 text-[11px] text-[#F5F1E8]/80">
                USD
              </span>
            </div>

            <div className="text-3xl sm:text-4xl font-display font-extrabold text-[#F5F1E8] mb-1 tabular-nums">
              ${balance.toFixed(2)}
            </div>
            <p className="text-xs text-[#F5F1E8]/60">
              الرصيد الفعلي الموثق عبر معاملات سحابية ذرية لشراء الوثائق والسلاسل والفحوصات.
            </p>
          </div>

          <div className="pt-6 border-t border-[#F5F1E8]/15 mt-6 flex items-center gap-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleTopUpWallet(20)}
              className="flex-1 py-2 px-3 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>شحن $20</span>
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleTopUpWallet(50)}
              className="flex-1 py-2 px-3 rounded-xl bg-[#F5F1E8]/15 hover:bg-[#F5F1E8]/25 text-[#F5F1E8] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>شحن $50</span>
            </button>
          </div>
        </div>

        {/* Annual Subscription Commercial Model Banner */}
        <div className="lg:col-span-2 rounded-2xl bg-[#F5F1E8] border border-[#D97757]/35 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#D97757] mb-2">
              <Crown className="w-4 h-4" />
              <span>النموذج التجاري لمنصة جذوري — الاشتراك السنوي + رصيد المحفظة</span>
            </div>
            <h3 className="text-lg font-display font-bold text-[#1F1F1C]">
              الاشتراك السنوي الشامل بريميوم ($60 / سنة)
            </h3>
            <p className="text-xs sm:text-sm text-[#1F1F1C]/75 mt-1 leading-relaxed">
              يشمل فتح عمود النسب الكامل حتى آدم عليه السلام، استعراض المخطوطات، ورفع سعة شجرتي إلى 250 فرداً وخزانتي إلى 100 وثيقة مع نشر موقعي الشخصي،{' '}
              <strong className="text-[#D97757]">
                بالإضافة إلى إيداع رصيد فوري بقيمة $25 في محفظتك الرقمية
              </strong>{' '}
              لاستخدامه في الخدمات الفاخرة!
            </p>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#D97757]/20 mt-4">
            <div className="text-xs">
              <span className="text-[#1F1F1C]/60 block">قيمة الاشتراك:</span>
              <span className="font-bold text-[#1F1F1C] text-base">$60 / سنوياً</span>
            </div>

            {isVip ? (
              <span className="px-4 py-2 rounded-xl bg-[#E8DED2] text-[#1F1F1C] text-xs font-bold inline-flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-[#D97757]" />
                <span>اشتراكك السنوي نشط حالياً</span>
              </span>
            ) : (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleAnnualUpgradeWithBonus}
                className="py-2.5 px-5 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs sm:text-sm font-display font-bold flex items-center gap-2 cursor-pointer transition-colors shadow-xs disabled:opacity-50"
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
      <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/30 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-display font-bold text-[#1F1F1C]">
              مزايا وخدمات يمكن شراؤها برصيد المحفظة
            </h3>
            <p className="text-xs text-[#1F1F1C]/70 mt-0.5">
              استثمر رصيد محفظتك الرقمية في توثيق إرث عائلتك عبر معاملات سحابية ذرية آمنة
            </p>
          </div>
          <span className="text-xs font-bold text-[#D97757]">خصم ذري مباشر من المحفظة</span>
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
          ].map((srv) => {
            const hasEnough = balance >= srv.cost;
            const shortfall = Math.max(0, srv.cost - balance);
            return (
              <div
                key={srv.id}
                className="rounded-xl border border-[#D97757]/30 bg-[#F5F1E8] p-4 flex flex-col justify-between hover:border-[#D97757] transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-[#F5F1E8] text-[#D97757] flex items-center justify-center shadow-2xs">
                      <srv.icon className="w-4 h-4" />
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-[#E8DED2] text-[10px] font-bold text-[#1F1F1C]/80">
                      {srv.badge}
                    </span>
                  </div>
                  <h4 className="text-sm font-display font-bold text-[#1F1F1C]">{srv.title}</h4>
                  <p className="text-xs text-[#1F1F1C]/70 mt-1 leading-relaxed">{srv.desc}</p>
                </div>

                <div className="pt-4 border-t border-[#D97757]/20 mt-3 flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-[#D97757] tabular-nums">
                    ${srv.cost}
                  </span>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handlePurchaseService(srv.title, srv.cost)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                      hasEnough
                        ? 'bg-[#1F1F1C] text-[#F5F1E8] hover:bg-[#D97757]'
                        : 'bg-[#E8DED2] text-[#D97757] hover:bg-[#D97757] hover:text-[#F5F1E8]'
                    }`}
                  >
                    {hasEnough
                      ? 'شراء بالرصيد'
                      : `شحن المتبقي ($${shortfall.toFixed(2)})`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Structured Financial Transaction Ledger (`wallet_transactions`) */}
      <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/30 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-display font-bold text-[#1F1F1C]">
              سجل الحركات والمعاملات المالية الموثّق
            </h3>
            <p className="text-[11px] text-[#1F1F1C]/65 mt-0.5">
              كل عملية موثقة برقم مرجعي فريد قابل للنسخ الفوري لمراجعته مع الدعم الفني عند الحاجة
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-[#F5F1E8] border border-[#D97757]/35 text-[11px] font-semibold text-[#D97757]">
            مدقق ذرياً في السحابة
          </span>
        </div>

        {transactions.length === 0 ? (
          <p className="text-xs text-[#1F1F1C]/60 text-center py-6">
            لا توجد حركات مالية مسجلة في محفظتك حتى الآن.
          </p>
        ) : (
          <div className="divide-y divide-[#D97757]/20">
            {transactions.map((tx) => {
              const isCredit = tx.direction
                ? tx.direction === 'credit'
                : tx.type === 'credit' || tx.type === 'TOPUP';
              const txRef = tx.transactionId || tx.id;
              const statusLabel =
                tx.status === 'FAILED'
                  ? 'فشلت'
                  : tx.status === 'PENDING'
                  ? 'قيد المعالجة'
                  : 'مكتملة';
              const isCopied = copiedTxId === txRef;

              return (
                <div
                  key={tx.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        isCredit
                          ? 'bg-[#E8DED2] text-[#D97757]'
                          : 'bg-[#E8DED2] text-[#D97757]'
                      }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[#1F1F1C]">
                          {tx.descriptionAr || tx.reason}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#F5F1E8] border border-[#D97757]/35 text-[10px] font-semibold text-[#D97757]">
                          {getStructuredTypeBadgeLabel(tx)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.status === 'FAILED'
                              ? 'bg-[#F5F1E8] text-[#D97757]'
                              : tx.status === 'PENDING'
                              ? 'bg-[#F5F1E8] text-[#1F1F1C]'
                              : 'bg-[#F5F1E8] text-[#1F1F1C]'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#1F1F1C]/65">
                        <span
                          dir="ltr"
                          className="font-mono font-bold text-[#1F1F1C] bg-[#F5F1E8] px-2 py-0.5 rounded border border-[#D97757]/30"
                        >
                          {txRef}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyTransactionId(txRef)}
                          title="نسخ الرقم المرجعي للعملية"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#E8DED2] hover:bg-[#D97757] hover:text-[#F5F1E8] text-[#1F1F1C] text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>نسخ المرجع</span>
                            </>
                          )}
                        </button>
                        <span>·</span>
                        <span>{new Date(tx.createdAt).toLocaleDateString('ar-SA')}</span>
                        <span>·</span>
                        <span className="tabular-nums">
                          {typeof tx.balanceBefore === 'number'
                            ? `الرصيد: $${tx.balanceBefore.toFixed(2)} ← $${tx.balanceAfter.toFixed(2)}`
                            : `الرصيد بعدها: $${tx.balanceAfter.toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    dir="ltr"
                    className={`font-mono font-bold text-sm tabular-nums self-end sm:self-center shrink-0 ${
                      isCredit ? 'text-[#D97757]' : 'text-[#D97757]'
                    }`}
                  >
                    {isCredit
                      ? `+$${tx.amount.toFixed(2)}`
                      : `-$${tx.amount.toFixed(2)}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
