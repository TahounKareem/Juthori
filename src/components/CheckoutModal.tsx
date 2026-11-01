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
} from 'lucide-react';
import { CheckoutOrderRequest } from '../types/juthori';

interface CheckoutModalProps {
  order: CheckoutOrderRequest | null;
  walletBalance: number;
  onClose: () => void;
  onConfirmSuccess: (
    order: CheckoutOrderRequest,
    paymentMethod: 'wallet' | 'mada' | 'card' | 'apple_pay',
    invoiceNumber: string
  ) => void;
  onQuickTopUpWallet?: (amountUsd: number) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  order,
  walletBalance,
  onClose,
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
  const [invoiceNumber, setInvoiceNumber] = useState('#INV-JTH-9042');

  useEffect(() => {
    if (order) {
      setStep('summary');
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      setInvoiceNumber(`#INV-JTH-${randomNum}`);
      if (order.allowWalletPayment && walletBalance >= order.amountUsd) {
        setPaymentMethod('wallet');
      } else {
        setPaymentMethod('mada');
      }
    }
  }, [order, walletBalance]);

  if (!order) return null;

  const canPayWithWallet =
    order.allowWalletPayment && walletBalance >= order.amountUsd;

  const handleStartPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentMethod === 'wallet' && !canPayWithWallet) {
      return;
    }
    setStep('processing');
    setTimeout(() => {
      setStep('receipt');
    }, 1500);
  };

  const handleFinishReceipt = () => {
    onConfirmSuccess(order, paymentMethod, invoiceNumber);
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
                بوابة السداد وتوثيق الصلاحيات — جذوري
              </h2>
              <p className="text-[11px] text-white/70">
                تشفير آمن ومرتبط مباشرة بمحرك شجرة آدم والمحفظة الرقمية
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
                    رصيد محفظة جذوري الحالي:
                  </span>
                  <span className="font-mono font-bold text-[#252321] tabular-nums">
                    ${walletBalance.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-semibold text-[#252321]">
                    قيمة فتح حلقات الأجداد الوسيطين / الخدمة:
                  </span>
                  <span className="font-mono font-bold text-[#D8755B] tabular-nums">
                    -${order.amountUsd.toFixed(2)}
                  </span>
                </div>

                {canPayWithWallet ? (
                  <div className="pt-2 border-t border-[#B98A78]/25 flex items-center justify-between text-xs font-bold text-[#8D4925]">
                    <span>الرصيد المتبقي بعد الخصم:</span>
                    <span className="font-mono tabular-nums">
                      ${(walletBalance - order.amountUsd).toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-[#B98A78]/25 space-y-2.5">
                    <p className="text-xs text-red-700 font-semibold">
                      رصيد المحفظة الحالي (${walletBalance.toFixed(2)}) أقل من قيمة الطلب (${order.amountUsd.toFixed(2)}). يمكنك شحن المحفظة فوراً أو اختيار بطاقة مدى / Visa:
                    </p>
                    {onQuickTopUpWallet && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onQuickTopUpWallet(15)}
                          className="px-3.5 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>شحن فوري للمحفظة (+$15)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('mada')}
                          className="px-3.5 py-2 rounded-xl bg-[#EDE6DA] text-[#252321] text-xs font-display font-bold cursor-pointer"
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

            {/* Submit Payment Button */}
            <div className="pt-1 flex flex-col sm:flex-row gap-2.5">
              <button
                type="submit"
                disabled={paymentMethod === 'wallet' && !canPayWithWallet}
                className="flex-1 py-3.5 px-5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-sm font-display font-extrabold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>
                  {paymentMethod === 'wallet'
                    ? `تأكيد خصم $${order.amountUsd.toFixed(2)} من المحفظة وفتح العُقد`
                    : `إتمام السداد الآن ($${order.amountUsd.toFixed(2)}) وتفعيل الصلاحيات`}
                </span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-3.5 px-4 rounded-xl bg-[#EDE6DA] hover:bg-[#e2d8c7] text-[#252321] text-xs font-display font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Processing Animation (1.5 seconds) */}
        {step === 'processing' && (
          <div className="p-10 sm:p-14 text-center space-y-5">
            <div className="w-20 h-20 rounded-full bg-[#D8755B]/15 border-2 border-[#D8755B] text-[#D8755B] flex items-center justify-center mx-auto shadow-inner">
              <Loader2 className="w-10 h-10 animate-spin" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-display font-extrabold text-[#252321]">
                جاري تأكيد عملية السداد وتوثيق الصلاحيات في شجرة آدم...
              </h3>
              <p className="text-xs sm:text-sm text-[#252321]/75 max-w-md mx-auto leading-relaxed">
                يتم الآن فك التشفير الأرشيفي للعُقد المطلوبة وربطها بسجل عائلتك الموثق.
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
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EDE6DA] border border-[#B98A78]/40 text-xs font-mono font-bold text-[#8D4925]">
                <Sparkles className="w-3.5 h-3.5 text-[#D8755B]" />
                <span>إيصال تأكيد معتمد · رقم العملية: {invoiceNumber}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-display font-extrabold text-[#252321]">
                تمت عملية السداد والتفعيل بنجاح!
              </h3>
              <p className="text-xs sm:text-sm text-[#252321]/80 max-w-md mx-auto leading-relaxed">
                تم توثيق وإتاحة <strong>«{order.title}»</strong> في حسابك بنجاح داخل شجرة آدم.
              </p>
            </div>

            <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-4 text-right text-xs space-y-2 max-w-md mx-auto">
              <div className="flex items-center justify-between">
                <span className="text-[#252321]/65">الخدمة المفعّلة:</span>
                <span className="font-bold text-[#252321]">{order.title}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#252321]/65">المبلغ المسدد:</span>
                <span className="font-mono font-bold text-[#D8755B]">
                  ${order.amountUsd.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#252321]/65">المرجع الأرشيفي:</span>
                <span className="font-mono font-semibold text-[#252321]">
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
