import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  Download,
  QrCode,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  ACTIVE_PUBLIC_SITE_DISPLAY_HOST,
  resolveClientPublicAppBaseUrl,
} from '../config/referralAndSiteConfig';

interface RoyalQrInvitationModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  familyName: string;
  siteSlug: string;
  emblemTag?: string;
  registrarName?: string;
  referralCode?: string;
}

export const RoyalQrInvitationModal: React.FC<RoyalQrInvitationModalProps> = ({
  isOpen,
  open,
  onClose,
  familyName,
  siteSlug,
  emblemTag,
  registrarName,
  referralCode,
}) => {
  const modalVisible = Boolean(isOpen ?? open);
  const [cardDataUrl, setCardDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const cleanSlug = (siteSlug || 'family').trim();
  const brandedBase = resolveClientPublicAppBaseUrl();
  const shareUrl = `${brandedBase}/${cleanSlug}${
    referralCode ? `?ref=${encodeURIComponent(referralCode)}` : ''
  }`;
  const displayPrettyUrl = `${ACTIVE_PUBLIC_SITE_DISPLAY_HOST}/${cleanSlug}`;

  useEffect(() => {
    if (!modalVisible) return;
    let active = true;

    (async () => {
      try {
        const qrDataUrl = await QRCode.toDataURL(shareUrl, {
          width: 420,
          margin: 2,
          color: {
            dark: '#252321',
            light: '#FFFFFF',
          },
        });

        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1350;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Warm heritage parchment backdrop
        ctx.fillStyle = '#F7F2E9';
        ctx.fillRect(0, 0, 1080, 1350);

        // Outer charcoal & terracotta royal double border
        ctx.strokeStyle = '#252321';
        ctx.lineWidth = 6;
        ctx.strokeRect(42, 42, 996, 1266);

        ctx.strokeStyle = '#B98A78';
        ctx.lineWidth = 2;
        ctx.strokeRect(58, 58, 964, 1234);

        // Top header banner
        ctx.fillStyle = '#252321';
        ctx.fillRect(58, 58, 964, 240);

        ctx.fillStyle = '#D8755B';
        ctx.fillRect(58, 294, 964, 6);

        ctx.textAlign = 'center';
        ctx.direction = 'rtl';

        ctx.fillStyle = '#E8C284';
        ctx.font = 'bold 28px Cairo, Tajawal, sans-serif';
        ctx.fillText(
          emblemTag || 'بطاقة دعوة عائلية موثقة · منصة جذوري',
          540,
          145
        );

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 54px Cairo, Tajawal, sans-serif';
        ctx.fillText(`ديوان وبوابة عائلة ${familyName}`, 540, 232);

        // Invitation copy
        ctx.fillStyle = '#252321';
        ctx.font = 'bold 34px Tajawal, Cairo, sans-serif';
        ctx.fillText('يسعدنا دعوتكم لتصفح بوابة الأسرة الرقمية وإثراء ذاكرتها', 540, 400);

        ctx.fillStyle = '#6E5A4C';
        ctx.font = '26px Tajawal, Cairo, sans-serif';
        ctx.fillText(
          `بإشراف وتوثيق أمين السجل: ${registrarName || 'أمين سجل العائلة'}`,
          540,
          456
        );

        // White QR pedestal frame
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(300, 520, 480, 480);
        ctx.strokeStyle = '#B98A78';
        ctx.lineWidth = 3;
        ctx.strokeRect(300, 520, 480, 480);

        const qrImg = new Image();
        qrImg.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          qrImg.onload = () => resolve();
          qrImg.onerror = () => resolve();
          qrImg.src = qrDataUrl;
        });
        ctx.drawImage(qrImg, 330, 550, 420, 420);

        // Clean sovereign root URL below QR
        ctx.fillStyle = '#252321';
        ctx.font = 'bold 34px monospace';
        ctx.direction = 'ltr';
        ctx.fillText(displayPrettyUrl, 540, 1085);

        ctx.direction = 'rtl';
        ctx.fillStyle = '#8D4925';
        ctx.font = 'bold 25px Tajawal, Cairo, sans-serif';
        ctx.fillText(
          'امسح الرمز بكاميرا الجوال للدخول المباشر إلى ديوان ومشجرة الأسرة',
          540,
          1155
        );

        ctx.fillStyle = '#6E6762';
        ctx.font = '22px Tajawal, Cairo, sans-serif';
        ctx.fillText(
          'منصة جذوري لحفظ الأنساب الموثقة والإرث العائلي العربي',
          540,
          1235
        );

        if (active) {
          setCardDataUrl(canvas.toDataURL('image/png'));
        }
      } catch {
        // Ignore canvas errors gracefully
      }
    })();

    return () => {
      active = false;
    };
  }, [modalVisible, shareUrl, familyName, emblemTag, registrarName, displayPrettyUrl]);

  if (!modalVisible) return null;

  const handleDownloadPng = () => {
    if (!cardDataUrl) return;
    const link = document.createElement('a');
    link.href = cardDataUrl;
    link.download = `Juthori-Royal-Card-${cleanSlug}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Ignore clipboard restriction
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#252321]/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/50 shadow-2xl overflow-hidden my-auto">
        <div className="bg-[#252321] text-[#F7F2E9] px-6 py-4 flex items-center justify-between border-b-2 border-[#D8755B]">
          <div className="flex items-center gap-2.5">
            <QrCode className="w-5 h-5 text-[#E8C284]" aria-hidden="true" />
            <h3 className="text-base font-display font-bold">
              بطاقة الدعوة الملكية لـ عائلة {familyName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#F7F2E9]/75 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-xl bg-white border border-[#B98A78]/35 p-3 flex items-center justify-center">
            {cardDataUrl ? (
              <img
                src={cardDataUrl}
                alt={`بطاقة الدعوة الملكية لعائلة ${familyName}`}
                referrerPolicy="no-referrer"
                className="w-full max-h-[380px] object-contain rounded-lg"
              />
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-[#252321]/60">
                جارٍ تجهيز البطاقة الملكية عالية الدقة...
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white border border-[#B98A78]/35 px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-[#8D4925] font-semibold">
                الرابط السيادي المختصر للطباعة والمشاركة في مجالس العائلة
              </div>
              <div
                dir="ltr"
                className="text-xs font-mono font-bold text-[#252321] truncate"
              >
                {shareUrl}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyUrl}
              className="px-3 py-2 rounded-lg bg-[#F7F2E9] hover:bg-[#EDE6DA] text-[#252321] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  <span>تم النسخ</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ الرابط</span>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-[#252321]/70">
              <ShieldCheck className="w-4 h-4 text-[#8D4925]" />
              <span>جاهزة للإرسال عبر واتساب أو الطباعة الفاخرة</span>
            </div>
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={!cardDataUrl}
              className="px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] disabled:opacity-50 text-white text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>تحميل البطاقة الملكية (PNG)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
