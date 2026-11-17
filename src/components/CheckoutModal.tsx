import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Lock,
  Loader2,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
  ArrowLeft,
  Plus,
  Copy,
  Check,
} from 'lucide-react';
import { CheckoutOrderRequest } from '../types/juthori';
import { generateWalletTransactionId } from '../services/firestoreService';

export interface CheckoutExecutionResult {
  status: 'COMPLETED' | 'ALREADY_OWNED' | 'INSUFFICIENT_FUNDS';
  transactionId?: string;
  balanceAfter?: number;
  shortfallUsd?: number;
}

interface CheckoutModalProps {
  order: CheckoutOrderRequest | null;
  walletBalance: number;
  onClose: () => void;
  onExecutePayment?: (
    order: CheckoutOrderRequest,
    paymentMethod: 'wallet' | 'mada' | 'card' | 'apple_pay'
  ) => Promise<CheckoutExecutionResult>;
  onConfirmSuccess: (
    order: CheckoutOrderRequest,
    paymentMethod: 'wallet' | 'mada' | 'card' | 'apple_pay',
    invoiceNumber: string,
    alreadyExecutedAtomically?: boolean
  ) => void;
  onQuickTopUpWallet?: (amountUsd: number) => Promise<void> | void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  order,
  walletBalance,
  onClose,
  onExecutePayment,
  onConfirmSuccess,
  onQuickTopUpWallet,
}) => {
  const [step, setStep] = useState<'summary' | 'processing' | 'receipt'>('summary');
  const [paymentMethod, setPaymentMethod] = useState<
    'wallet' | 'mada' | 'card' | 'apple_pay'
  >('mada');
  const [cardHolder, setCardHolder] = useState('HASSAN ZUHAIR ALMUQIT');
  const [cardNumber, setCardNumber] = useState('4458 •••• •••• 9042');
  const [cardExpiry, setCardExpiry] = useState('08/29');
  const [cardCvv, setCardCvv] = useState('842');
  const [invoiceNumber, setInvoiceNumber] = useState(() =>
    generateWalletTransactionId()
  );
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isQuickToppingUp, setIsQuickToppingUp] = useState(false);
  const [alreadyOwnedNotice, setAlreadyOwnedNotice] = useState(false);
  const [executedAtomically, setExecutedAtomically] = useState(false);
  const [serverShortfallUsd, setServerShortfallUsd] = useState<number | null>(null);
  const [copiedReceiptRef, setCopiedReceiptRef] = useState(false);

  // Reset modal ONLY when a new order opens (do not reset step when walletBalance updates!)
  useEffect(() => {
    if (order) {
      setStep('summary');
      setInvoiceNumber(generateWalletTransactionId());
      setIsSubmittingPayment(false);
      setAlreadyOwnedNotice(false);
      setExecutedAtomically(false);
      setServerShortfallUsd(null);
      setCopiedReceiptRef(false);
      if (order.allowWalletPayment && walletBalance >= order.amountUsd) {
        setPaymentMethod('wallet');
      } else {
        setPaymentMethod('mada');
      }
    }
  }, [order?.id]);

  // If the customer tops up their wallet while on the summary screen, clear shortfall automatically
  useEffect(() => {
    if (order && step === 'summary' && walletBalance >= order.amountUsd) {
      setServerShortfallUsd(null);
    }
  }, [walletBalance, order, step]);

  if (!order) return null;

  const canPayWithWallet =
    order.allowWalletPayment && walletBalance >= order.amountUsd;

  const exactShortfallUsd =
    serverShortfallUsd !== null
      ? serverShortfallUsd
      : Math.max(0, Number((order.amountUsd - walletBalance).toFixed(2)));

  const handleCopyInvoice = async () => {
    try {
      await navigator.clipboard.writeText(invoiceNumber);
      setCopiedReceiptRef(true);
      setTimeout(() => setCopiedReceiptRef(false), 2200);
    } catch {
      // Ignore clipboard restriction
    }
  };

  const handleQuickTopUpClick = async (amountToTopUp: number) => {
    if (!onQuickTopUpWallet || isQuickToppingUp) return;
    setIsQuickToppingUp(true);
    try {
      await onQuickTopUpWallet(Number(amountToTopUp.toFixed(2)));
      setServerShortfallUsd(null);
      setPaymentMethod('wallet');
    } finally {
      setIsQuickToppingUp(false);
    }
  };

  const handleStartPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingPayment) return;

    if (paymentMethod === 'wallet' && !canPayWithWallet && !onExecutePayment) {
      return;
    }

    setIsSubmittingPayment(true);
    setStep('processing');

    if (onExecutePayment) {
      try {
        const res = await onExecutePayment(order, paymentMethod);
        if (res.status === 'INSUFFICIENT_FUNDS') {
          setServerShortfallUsd(
            res.shortfallUsd ??
              Math.max(0, Number((order.amountUsd - walletBalance).toFixed(2)))
          );
          setStep('summary');
          setIsSubmittingPayment(false);
          return;
        }

        if (res.transactionId) {
          setInvoiceNumber(res.transactionId);
        }
        setAlreadyOwnedNotice(res.status === 'ALREADY_OWNED');
        setExecutedAtomically(true);
        setStep('receipt');
      } catch {
        setStep('summary');
      } finally {
        setIsSubmittingPayment(false);
      }
      return;
    }

    setTimeout(() => {
      setIsSubmittingPayment(false);
      setStep('receipt');
    }, 900);
  };

  const handleFinishReceipt = () => {
    onConfirmSuccess(order, paymentMethod, invoiceNumber, executedAtomically);
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#252321]/75 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
    >
      <div className="w-full max-w-xl rounded-3xl bg-[#F7F2E9] border-2 border-[#B98A78]/60 shadow-2xl overflow-hidden my-auto">
        {/* Top Header */}
        <div className="bg-[#252321] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#D8755B] text-white flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="checkout-modal-title"
                className="text-sm sm:text-base font-display font-bold"
              >
                بوابة السداد الذري وتوثيق الصلاحيات — جذوري
              </h2>
              <p className="text-[11px] text-white/70">
                حماية ضد الخصم المزدوج ومرتبط مباشرة بمحرك شجرة آدم والمحفظة الرقمية
              </p>
            </div>
          </div>

          {step !== 'processing' && (
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق نافذة الدفع"
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* STEP 1: Order Summary & Payment Method Selection */}
        {step === 'summary' && (
          <form onSubmit={handleStartPayment} className="p-6 sm:p-7 space-y-5">
            {/* Order Summary Card */}
            <div className="rounded-2xl bg-white border border-[#B98A78]/45 p-4 sm:p-5 space-y-2 shadow-2xs">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-display font-bold text-[#D8755B]">
                    ملخص الطلب الموثق
                  </span>
                  <h3 className="text-base sm:text-lg font-display font-extrabold text-[#252321] mt-0.5">
                    {order.title}
                  </h3>
                  <p className="text-xs text-[#252321]/75 mt-1 leading-relaxed">
                    {order.subtitle}
                  </p>
                </div>
                <div className="text-left shrink-0 bg-[#F7F2E9] border border-[#B98A78]/35 px-3.5 py-2 rounded-xl">
                  <div className="text-[10px] text-[#252321]/65">الإجمالي</div>
                  <div className="text-xl font-display font-extrabold text-[#D8755B] tabular-nums">
                    ${order.amountUsd.toFixed(2)}
                  </div>
                </div>
              </div>

              {order.bonusWalletUsd && order.bonusWalletUsd > 0 && (
                <div className="pt-2.5 mt-2 border-t border-[#B98A78]/25 flex items-center justify-between text-xs font-bold text-[#8D4925]">
                  <span>🎁 هدية مجانية مرفقة مع الباقة السنوية:</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#D8755B]/15 text-[#D8755B]">
                    +${order.bonusWalletUsd} رصيد محفظة فوري لفتح حلقات الأجداد الوسيطين
                  </span>
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2.5">
              <label className="block text-xs font-display font-bold text-[#252321]">
                اختر وسيلة الدفع المفضلة:
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {order.allowWalletPayment && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('wallet')}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      paymentMethod === 'wallet'
                        ? 'bg-[#252321] text-white border-[#252321] shadow-xs'
                        : 'bg-white text-[#252321] border-[#B98A78]/45 hover:bg-[#EDE6DA]'
                    }`}
                  >
                    <Wallet
                      className={`w-4 h-4 ${
                        paymentMethod === 'wallet' ? 'text-[#D8755B]' : 'text-[#8D4925]'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-display font-bold">محفظة جذوري</div>
                      <div
                        className={`text-[10px] tabular-nums ${
                          paymentMethod === 'wallet'
                            ? 'text-white/75'
                            : 'text-[#252321]/65'
                        }`}
                      >
                        الرصيد: ${walletBalance.toFixed(2)}
                      </div>
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setPaymentMethod('mada')}
                  className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    paymentMethod === 'mada'
                      ? 'bg-[#252321] text-white border-[#252321] shadow-xs'
                      : 'bg-white text-[#252321] border-[#B98A78]/45 hover:bg-[#EDE6DA]'
                  }`}
                >
                  <CreditCard
                    className={`w-4 h-4 ${
                      paymentMethod === 'mada' ? 'text-[#D8755B]' : 'text-[#252321]'
                    }`}
                  />
                  <div>
                    <div className="text-xs font-display font-bold">بطاقة مدى</div>
                    <div
                      className={`text-[10px] ${
                        paymentMethod === 'mada' ? 'text-white/75' : 'text-[#252321]/65'
                      }`}
                    >
                      Mada Pay
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    paymentMethod === 'card'
                      ? 'bg-[#252321] text-white border-[#252321] shadow-xs'
                      : 'bg-white text-[#252321] border-[#B98A78]/45 hover:bg-[#EDE6DA]'
                  }`}
                >
                  <CreditCard
                    className={`w-4 h-4 ${
                      paymentMethod === 'card' ? 'text-[#D8755B]' : 'text-[#252321]'
                    }`}
                  />
                  <div>
                    <div className="text-xs font-display font-bold">بطاقة ائتمانية</div>
                    <div
                      className={`text-[10px] ${
                        paymentMethod === 'card' ? 'text-white/75' : 'text-[#252321]/65'
                      }`}
                    >
                      Visa / Master
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('apple_pay')}
                  className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    paymentMethod === 'apple_pay'
                      ? 'bg-[#252321] text-white border-[#252321] shadow-xs'
                      : 'bg-white text-[#252321] border-[#B98A78]/45 hover:bg-[#EDE6DA]'
                  }`}
                >
                  <Lock
                    className={`w-4 h-4 ${
                      paymentMethod === 'apple_pay' ? 'text-[#D8755B]' : 'text-[#252321]'
                    }`}
                  />
                  <div>
                    <div className="text-xs font-display font-bold">Apple Pay</div>
                    <div
                      className={`text-[10px] ${
                        paymentMethod === 'apple_pay'
                          ? 'text-white/75'
                          : 'text-[#252321]/65'
                      }`}
                    >
                      دفع بنقرة واحدة
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Payment Details Box */}
            {paymentMethod === 'wallet' ? (
              <div className="rounded-2xl bg-white border border-[#B98A78]/45 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-semibold text-[#252321]">
                    رصيد محفظة جذوري الفعلي الحالي:
                  </span>
                  <span className="font-mono font-bold text-[#252321] tabular-nums">
                    ${walletBalance.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-semibold text-[#252321]">
                    قيمة الباقة / الخدمة المطلوبة:
                  </span>
                  <span className="font-mono font-bold text-[#D8755B] tabular-nums">
                    -${order.amountUsd.toFixed(2)}
                  </span>
                </div>

                {canPayWithWallet ? (
                  <div className="pt-2 border-t border-[#B98A78]/25 flex items-center justify-between text-xs font-bold text-[#8D4925]">
                    <span>الرصيد المتبقي بعد الخصم الذري:</span>
                    <span className="font-mono tabular-nums">
                      ${(walletBalance - order.amountUsd).toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <div className="pt-2.5 border-t border-[#B98A78]/25 space-y-3">
                    <div className="rounded-xl bg-amber-50 border border-amber-300 px-3.5 py-2.5 text-xs text-amber-950 space-y-1">
                      <div className="font-display font-extrabold">
                        رصيد المحفظة الحالي (${walletBalance.toFixed(2)}) غير كافٍ — المبلغ المتبقي بدقة:{' '}
                        <span className="font-mono text-[#D8755B]">
                          ${exactShortfallUsd.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-900/85">
                        اشحن المبلغ المتبقي فوراً أدناه أو اختر السداد المباشر عبر بطاقة مدى / Visa.
                      </p>
                    </div>
                    {onQuickTopUpWallet && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isQuickToppingUp}
                          onClick={() => handleQuickTopUpClick(exactShortfallUsd || 5)}
                          className="px-3.5 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isQuickToppingUp ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                          <span>
                            شحن المبلغ المتبقي فوراً (+${exactShortfallUsd.toFixed(2)})
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={isQuickToppingUp}
                          onClick={() => handleQuickTopUpClick(20)}
                          className="px-3 py-2 rounded-xl bg-[#252321] hover:bg-[#3a3734] text-white text-xs font-display font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Plus className="w-3 h-3" />
                          <span>شحن +$20</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('mada')}
                          className="px-3 py-2 rounded-xl bg-[#EDE6DA] text-[#252321] text-xs font-display font-bold cursor-pointer"
                        >
                          الدفع ببطاقة مدى مباشرة
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : paymentMethod === 'apple_pay' ? (
              <div className="rounded-2xl bg-white border border-[#B98A78]/45 p-5 text-center space-y-2">
                <div className="text-sm font-display font-bold text-[#252321]">
                  Apple Pay جاهز للتفويض الفوري
                </div>
                <p className="text-xs text-[#252321]/70">
                  اضغط على زر التأكيد بالأسفل لإتمام عملية السداد بقيمة ${order.amountUsd.toFixed(2)} وتفعيل العُقد فوراً.
                </p>
              </div>
            ) : (
              /* Pre-filled Demo Card Fields Ready for One-Click Testing */
              <div className="rounded-2xl bg-white border border-[#B98A78]/45 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#252321]">
                    بيانات البطاقة التجريبية (جاهزة للتجربة بنقرة واحدة)
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#EDE6DA] text-[#8D4925] font-semibold">
                    {paymentMethod === 'mada' ? 'مدى — Mada' : 'Visa / MasterCard'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#252321]/70 mb-1">
                      اسم حامل البطاقة
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      className="w-full rounded-xl bg-[#F7F2E9] border border-[#B98A78]/45 px-3 py-2 text-xs font-mono text-[#252321]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#252321]/70 mb-1">
                      رقم البطاقة
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full rounded-xl bg-[#F7F2E9] border border-[#B98A78]/45 px-3 py-2 text-xs font-mono text-[#252321]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#252321]/70 mb-1">
                      تاريخ الانتهاء
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full rounded-xl bg-[#F7F2E9] border border-[#B98A78]/45 px-3 py-2 text-xs font-mono text-[#252321]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#252321]/70 mb-1">
                      رمز الأمان (CVV)
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      className="w-full rounded-xl bg-[#F7F2E9] border border-[#B98A78]/45 px-3 py-2 text-xs font-mono text-[#252321]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Submit Payment Button (Locked during transaction to prevent double-charge) */}
            <div className="pt-1 flex flex-col sm:flex-row gap-2.5">
              <button
                type="submit"
                disabled={
                  isSubmittingPayment ||
                  (paymentMethod === 'wallet' && !canPayWithWallet)
                }
                className="flex-1 py-3.5 px-5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-sm font-display font-extrabold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingPayment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span>
                  {isSubmittingPayment
                    ? 'جاري تنفيذ المعاملة السحابية الذرية...'
                    : paymentMethod === 'wallet'
                    ? `تأكيد خصم $${order.amountUsd.toFixed(2)} من المحفظة وفتح العُقد`
                    : `إتمام السداد الآن ($${order.amountUsd.toFixed(2)}) وتفعيل الصلاحيات`}
                </span>
              </button>
              <button
                type="button"
                disabled={isSubmittingPayment}
                onClick={onClose}
                className="py-3.5 px-4 rounded-xl bg-[#EDE6DA] hover:bg-[#e2d8c7] text-[#252321] text-xs font-display font-bold cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Atomic Cloud Transaction Processing */}
        {step === 'processing' && (
          <div className="p-10 sm:p-14 text-center space-y-5">
            <div className="w-20 h-20 rounded-full bg-[#D8755B]/15 border-2 border-[#D8755B] text-[#D8755B] flex items-center justify-center mx-auto shadow-inner">
              <Loader2 className="w-10 h-10 animate-spin" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-display font-extrabold text-[#252321]">
                جاري تنفيذ المعاملة الذرية وتوثيق الصلاحيات في شجرة آدم...
              </h3>
              <p className="text-xs sm:text-sm text-[#252321]/75 max-w-md mx-auto leading-relaxed">
                يتم التحقق السحابي الفوري من الرصيد وعدم التكرار وتوثيق المرجع المالي المعتمد.
              </p>
            </div>
          </div>
        )}

        {/* STEP 3: Celebratory Payment Success Receipt */}
        {step === 'receipt' && (
          <div className="p-6 sm:p-8 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#D8755B] to-[#8D4925] text-white flex items-center justify-center mx-auto shadow-lg ring-8 ring-[#D8755B]/20">
              <CheckCircle2 className="w-11 h-11" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EDE6DA] border border-[#B98A78]/40 text-xs font-mono font-bold text-[#8D4925]">
                <Sparkles className="w-3.5 h-3.5 text-[#D8755B]" />
                <span dir="ltr">{invoiceNumber}</span>
                <button
                  type="button"
                  onClick={handleCopyInvoice}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white hover:bg-[#D8755B] hover:text-white text-[#252321] text-[10px] font-sans font-bold transition-colors cursor-pointer"
                >
                  {copiedReceiptRef ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>نسخ الرقم المرجعي</span>
                    </>
                  )}
                </button>
              </div>
              <h3 className="text-xl sm:text-2xl font-display font-extrabold text-[#252321]">
                {alreadyOwnedNotice
                  ? 'الميزة مفعّلة مسبقاً في حسابك!'
                  : 'تمت عملية السداد والتفعيل الذري بنجاح!'}
              </h3>
              <p className="text-xs sm:text-sm text-[#252321]/80 max-w-md mx-auto leading-relaxed">
                {alreadyOwnedNotice
                  ? `تم التحقق السحابي من ملكيتك السابقة لـ «${order.title}» — لم يتم خصم أي سنت إضافي ($0.00).`
                  : `تم توثيق وإتاحة «${order.title}» في حسابك بنجاح داخل شجرة آدم والسجل المالي.`}
              </p>
            </div>

            <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-4 text-right text-xs space-y-2 max-w-md mx-auto">
              <div className="flex items-center justify-between">
                <span className="text-[#252321]/65">الخدمة المفعّلة:</span>
                <span className="font-bold text-[#252321]">{order.title}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#252321]/65">المبلغ المسدد فعلياً:</span>
                <span className="font-mono font-bold text-[#D8755B]">
                  {alreadyOwnedNotice ? '$0.00 (مفعّلة مسبقاً)' : `$${order.amountUsd.toFixed(2)}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#252321]/65">المرجع المالي الموحد:</span>
                <span dir="ltr" className="font-mono font-semibold text-[#252321]">
                  {invoiceNumber}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleFinishReceipt}
              className="w-full py-3.5 px-6 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-sm sm:text-base font-display font-extrabold flex items-center justify-center gap-2 transition-colors shadow-md cursor-pointer"
            >
              <span>عرض العُقد المفتوحة في عمود نسبي الآن ←</span>
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
