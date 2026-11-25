import React, { useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  FileSignature,
  Globe,
  ListFilter,
  Lock,
  Printer,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import {
  RECORD_KEEPER_ARTICLES,
  RECORD_KEEPER_CONTRACT_METADATA,
  RECORD_KEEPER_CONTRACT_VERSION,
  RECORD_KEEPER_PREAMBLE,
  RECORD_KEEPER_TOC,
} from '../data/recordKeeperContractData';
import { LegalAuditTrailEntry } from '../services/firestoreService';

interface RecordKeeperContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAlreadySigned: boolean;
  clientFullName: string;
  familyName: string;
  userEmail: string;
  userPhone?: string;
  originCountry: string;
  originRegion?: string;
  orderReference: string;
  ipAddress: string;
  ipCountry?: string;
  ipCity?: string;
  existingAuditEntry?: LegalAuditTrailEntry | null;
  onConfirmElectronicSignature: () => Promise<LegalAuditTrailEntry>;
  onProceedToMyTree: () => void;
}

export const RecordKeeperContractModal: React.FC<RecordKeeperContractModalProps> = ({
  isOpen,
  onClose,
  isAlreadySigned,
  clientFullName,
  familyName,
  userEmail,
  userPhone,
  originCountry,
  originRegion,
  orderReference,
  ipAddress,
  ipCountry,
  ipCity,
  existingAuditEntry,
  onConfirmElectronicSignature,
  onProceedToMyTree,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSectionId, setActiveSectionId] = useState<string>('order-details');
  const [showMobileToc, setShowMobileToc] = useState(false);
  const [agreedToElectronicSignature, setAgreedToElectronicSignature] = useState(
    isAlreadySigned
  );
  const [consentError, setConsentError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [completedAuditEntry, setCompletedAuditEntry] =
    useState<LegalAuditTrailEntry | null>(existingAuditEntry || null);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);

  const documentScrollRef = useRef<HTMLDivElement | null>(null);

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return RECORD_KEEPER_ARTICLES;
    return RECORD_KEEPER_ARTICLES.filter(
      (art) =>
        art.number.includes(q) ||
        art.title.includes(q) ||
        art.paragraphs.some((p) => p.includes(q))
    );
  }, [searchQuery]);

  if (!isOpen) return null;

  const scrollToSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setShowMobileToc(false);
    const container = documentScrollRef.current;
    if (!container) return;
    const target = container.querySelector(`#${sectionId}`) as HTMLElement | null;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSignNow = async () => {
    if (!agreedToElectronicSignature) {
      setConsentError(
        'يلزم تحديد مربع الموافقة على التوقيع الإلكتروني وسجل التدقيق (Audit Trail) وشهادة الإكمال لإتمام التوقيع وتفعيل أمين السجل.'
      );
      scrollToSection('electronic-signature-section');
      return;
    }
    setConsentError(null);
    setIsSigning(true);
    try {
      const signedEntry = await onConfirmElectronicSignature();
      setCompletedAuditEntry(signedEntry);
      setShowSuccessScreen(true);
    } finally {
      setIsSigning(false);
    }
  };

  const effectiveAudit = completedAuditEntry || existingAuditEntry;
  const currentTimestampDisplay =
    effectiveAudit?.signedAtFormatted ||
    `${new Date().toLocaleDateString('ar-SA')} — ${new Date().toLocaleTimeString(
      'ar-SA',
      { hour: '2-digit', minute: '2-digit' }
    )}`;
  const certificateCodeDisplay =
    effectiveAudit?.certificateCode ||
    `JTH-CERT-RK-${orderReference.replace(/[^A-Z0-9]/gi, '').slice(-6) || '2026'}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1F1C]/75 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-keeper-contract-title"
      dir="rtl"
    >
      <div className="w-full max-w-6xl rounded-3xl bg-[#F5F1E8] border-2 border-[#D97757]/60 shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* ================================================================= */}
        {/* TOP OFFICIAL HEADER BAR                                           */}
        {/* ================================================================= */}
        <div className="bg-[#E8DED2] text-[#1F1F1C] px-4 sm:px-7 py-4 border-b border-[#D8C7B2] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#D97757] text-[#F5F1E8] flex items-center justify-center shadow-sm shrink-0">
              <FileSignature className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-[#FAF7F2] border border-[#D8C7B2] text-[#D97757] font-mono text-[11px] font-bold">
                  {RECORD_KEEPER_CONTRACT_VERSION}
                </span>
                <span className="text-xs text-[#1F1F1C]/75 font-semibold">
                  GeneaLab LLC · الولايات المتحدة الأمريكية
                </span>
                {(isAlreadySigned || showSuccessScreen) && (
                  <span className="px-2.5 py-0.5 rounded-md bg-[#FAF7F2] border border-[#D97757]/40 text-[#D97757] text-[11px] font-bold">
                    موقّع وموثّق إلكترونياً ✓
                  </span>
                )}
              </div>
              <h2
                id="record-keeper-contract-title"
                className="text-sm sm:text-lg font-display font-extrabold text-[#1F1F1C] truncate mt-0.5"
              >
                {RECORD_KEEPER_CONTRACT_METADATA.mainTitle}{' '}
                <span className="text-[#D97757] font-normal text-xs sm:text-sm">
                  {RECORD_KEEPER_CONTRACT_METADATA.subTitle}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowMobileToc((v) => !v)}
              className="lg:hidden px-3 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#D8C7B2]/50 border border-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ListFilter className="w-4 h-4 text-[#D97757]" />
              <span>فهرس المواد (29)</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              title="طباعة أو حفظ نسخة PDF"
              className="hidden sm:inline-flex px-3 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#D8C7B2]/50 border border-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-bold items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[#D97757]" />
              <span>طباعة العقد</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق نافذة العقد"
              className="w-9 h-9 rounded-xl bg-[#FAF7F2] hover:bg-[#D97757] hover:text-[#F5F1E8] border border-[#D8C7B2] text-[#1F1F1C] flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* POST-SIGNATURE SUCCESS & CERTIFICATE SCREEN                       */}
        {/* ================================================================= */}
        {showSuccessScreen ? (
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-gradient-to-b from-[#F5F1E8] to-[#F5F1E8]">
            <div className="max-w-3xl mx-auto rounded-3xl bg-[#F5F1E8] border-2 border-[#D97757]/40 p-6 sm:p-9 shadow-xl space-y-6 text-right">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#D97757]/25">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#D97757] text-[#F5F1E8] flex items-center justify-center shadow-lg shrink-0">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] text-[#1F1F1C] text-xs font-bold mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#D97757]" />
                      <span>تم التوقيع الإلكتروني وإصدار شهادة الإكمال بنجاح</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-display font-extrabold text-[#1F1F1C]">
                      تفعيل صلاحية «أمين السجل» لعائلة {familyName} ✓
                    </h3>
                  </div>
                </div>
                <div className="text-left font-mono text-xs bg-[#F5F1E8] border border-[#D97757]/40 px-3.5 py-2 rounded-xl">
                  <div className="text-[#D97757] font-bold">رقم شهادة الإكمال:</div>
                  <div className="text-[#1F1F1C] font-extrabold">
                    {certificateCodeDisplay}
                  </div>
                </div>
              </div>

              <p className="text-sm text-[#1F1F1C]/85 leading-relaxed">
                تم اعتماد توقيعك الإلكتروني على{' '}
                <strong>
                  «{RECORD_KEEPER_CONTRACT_METADATA.mainTitle} (
                  {RECORD_KEEPER_CONTRACT_VERSION})»
                </strong>{' '}
                وتسجيله رسمياً في <strong>سجل التدقيق الإلكتروني (Audit Trail)</strong>{' '}
                المرتبط بحسابك في قاعدة البيانات، وترقية صفتك القانونية إلى{' '}
                <strong className="text-[#D97757]">«رب أسرة / أمين السجل»</strong>.
              </p>

              {/* Official Certificate of Completion & Audit Trail Summary Card */}
              <div className="rounded-2xl bg-[#F5F1E8] border-2 border-[#D97757]/50 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#D97757]/30 pb-3">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-display font-extrabold text-[#1F1F1C]">
                    <ShieldCheck className="w-5 h-5 text-[#D97757]" />
                    <span>
                      شهادة الإكمال وسجل التدقيق الإلكتروني (Audit Trail & Certificate of
                      Completion)
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded bg-[#E8DED2] text-[#1F1F1C] font-mono text-[11px] font-bold">
                    COMPLETED_AND_SEALED
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]">
                    <div className="text-[#1F1F1C]/70 mb-0.5">العميل / أمين السجل:</div>
                    <div className="font-bold text-[#1F1F1C]">{clientFullName}</div>
                    <div className="text-[11px] text-[#D97757] font-mono mt-0.5">
                      {userEmail}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]">
                    <div className="text-[#1F1F1C]/70 mb-0.5">الجهة المنفذة:</div>
                    <div className="font-bold text-[#1F1F1C]">GeneaLab LLC</div>
                    <div className="text-[11px] text-[#1F1F1C]/70 mt-0.5">
                      Sheridan, WY 82801, USA
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]">
                    <div className="text-[#1F1F1C]/70 mb-0.5">رقم الطلب / المرجع:</div>
                    <div className="font-mono font-bold text-[#1F1F1C]">
                      {orderReference}
                    </div>
                    <div className="text-[11px] text-[#D97757] mt-0.5">
                      الإصدار: {RECORD_KEEPER_CONTRACT_VERSION}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]">
                    <div className="text-[#1F1F1C]/70 mb-0.5">ختم الوقت والتاريخ (UTC):</div>
                    <div className="font-mono font-bold text-[#1F1F1C]">
                      {currentTimestampDisplay}
                    </div>
                    <div className="text-[10px] font-mono text-[#1F1F1C]/70 mt-0.5" dir="ltr">
                      {effectiveAudit?.signedAtIso || new Date().toISOString()}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]">
                    <div className="text-[#1F1F1C]/70 mb-0.5">
                      عنوان بروتوكول الإنترنت (IP):
                    </div>
                    <div className="font-mono font-bold text-[#1F1F1C]" dir="ltr">
                      {effectiveAudit?.ipAddress || ipAddress || '127.0.0.1'}
                    </div>
                    <div className="text-[11px] text-[#1F1F1C]/70 mt-0.5">
                      {[ipCountry || originCountry, ipCity || originRegion]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]">
                    <div className="text-[#1F1F1C]/70 mb-0.5">معرف سجل التدقيق (Audit ID):</div>
                    <div className="font-mono font-bold text-[#D97757] truncate" dir="ltr">
                      {effectiveAudit?.id || certificateCodeDisplay}
                    </div>
                    <div className="text-[11px] text-[#1F1F1C] font-bold mt-0.5">
                      محفوظ في Firebase (audit_trail) ✓
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSuccessScreen(false)}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#E8DED2] hover:bg-[#D8C7B2]/60 text-[#1F1F1C] text-xs sm:text-sm font-display font-bold cursor-pointer"
                >
                  مراجعة نص العقد الموقّع
                </button>

                <button
                  type="button"
                  onClick={onProceedToMyTree}
                  className="w-full sm:flex-1 py-3.5 px-6 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-sm sm:text-base font-display font-extrabold inline-flex items-center justify-center gap-2.5 shadow-lg transition-colors cursor-pointer"
                >
                  <span>الانتقال الآن إلى صفحة «شجرتي» التفاعلية</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ================================================================= */
          /* MAIN ORGANIZED CONTRACT READER + SIDEBAR TOC                      */
          /* ================================================================= */
          <>
            <div className="flex-1 flex overflow-hidden relative">
              {/* Right Sidebar: Interactive Table of Contents + Search */}
              <aside
                className={`${
                  showMobileToc
                    ? 'absolute inset-y-0 right-0 z-30 w-80 shadow-2xl'
                    : 'hidden lg:flex lg:w-80'
                } bg-[#F5F1E8] border-l border-[#D97757]/40 flex-col shrink-0`}
              >
                <div className="p-3.5 border-b border-[#D97757]/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-display font-extrabold text-[#1F1F1C] flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-[#D97757]" />
                      <span>جدول المحتويات (29 مادة)</span>
                    </span>
                    {showMobileToc && (
                      <button
                        type="button"
                        onClick={() => setShowMobileToc(false)}
                        className="text-xs font-bold text-[#D97757] cursor-pointer"
                      >
                        إغلاق ✕
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث داخل مواد العقد..."
                      className="w-full rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 pr-3 pl-8 py-2 text-xs text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                    />
                    <Search className="w-3.5 h-3.5 text-[#D97757] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2.5 space-y-1 text-right">
                  <button
                    type="button"
                    onClick={() => scrollToSection('order-details')}
                    className={`w-full text-right px-3 py-2 rounded-xl text-xs font-display font-bold transition-colors cursor-pointer ${
                      activeSectionId === 'order-details'
                        ? 'bg-[#D97757] text-[#F5F1E8]'
                        : 'text-[#1F1F1C] hover:bg-[#E8DED2]'
                    }`}
                  >
                    • صفحة بيانات الطلب (Order Details)
                  </button>

                  <button
                    type="button"
                    onClick={() => scrollToSection('contract-preamble')}
                    className={`w-full text-right px-3 py-2 rounded-xl text-xs font-display font-bold transition-colors cursor-pointer ${
                      activeSectionId === 'contract-preamble'
                        ? 'bg-[#D97757] text-[#F5F1E8]'
                        : 'text-[#1F1F1C] hover:bg-[#E8DED2]'
                    }`}
                  >
                    • تمهيد وبيانات الأطراف
                  </button>

                  <div className="pt-1 pb-0.5 px-2 text-[10px] font-bold text-[#D97757] uppercase">
                    مواد العقد (1 – 29)
                  </div>

                  {RECORD_KEEPER_ARTICLES.map((art) => (
                    <button
                      key={art.id}
                      type="button"
                      onClick={() => scrollToSection(art.id)}
                      className={`w-full text-right px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer truncate ${
                        activeSectionId === art.id
                          ? 'bg-[#D97757] text-[#F5F1E8] font-bold'
                          : 'text-[#1F1F1C]/85 hover:bg-[#E8DED2]'
                      }`}
                    >
                      {art.number}: {art.title}
                    </button>
                  ))}

                  <div className="pt-2 border-t border-[#D97757]/30 mt-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => scrollToSection('electronic-signature-section')}
                      className={`w-full text-right px-3 py-2 rounded-xl text-xs font-display font-bold transition-colors cursor-pointer ${
                        activeSectionId === 'electronic-signature-section'
                          ? 'bg-[#D97757] text-[#F5F1E8]'
                          : 'text-[#D97757] hover:bg-[#E8DED2]'
                      }`}
                    >
                      • التوقيع وسجل التدقيق وشهادة الإكمال
                    </button>
                  </div>
                </div>
              </aside>

              {/* Left Main Contract Content Reader */}
              <div
                ref={documentScrollRef}
                className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 bg-[#F5F1E8]"
              >
                {/* Official Document Banner Card */}
                <div className="rounded-2xl bg-[#F5F1E8] border-2 border-[#D97757]/55 p-5 sm:p-7 shadow-xs text-center space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#F5F1E8] border border-[#D97757]/40 text-[#D97757] font-mono text-xs font-bold">
                    <span>{RECORD_KEEPER_CONTRACT_VERSION}</span>
                  </div>
                  <h1 className="text-lg sm:text-2xl font-display font-extrabold text-[#1F1F1C] leading-snug">
                    عقد تقديم خدمة توثيق عمود النسب وإصدار سجل تراث العائلة
                  </h1>
                  <p className="text-xs sm:text-sm font-display font-bold text-[#D97757]">
                    (السجل الأساسي - البوابة الرئيسية)
                  </p>
                </div>

                {/* Collapsible Full Table of Contents Box inside Document */}
                <details className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/45 p-4 text-right group">
                  <summary className="cursor-pointer font-display font-bold text-xs sm:text-sm text-[#1F1F1C] flex items-center justify-between">
                    <span>📋 جدول المحتويات الكامل للعقد ({RECORD_KEEPER_TOC.length} بنداً)</span>
                    <span className="text-xs text-[#D97757] group-open:rotate-180 transition-transform">
                      ▼
                    </span>
                  </summary>
                  <div className="mt-3 pt-3 border-t border-[#D97757]/25 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-[#1F1F1C]/85">
                    {RECORD_KEEPER_TOC.map((item, idx) => (
                      <div key={idx} className="py-0.5">
                        • {item}
                      </div>
                    ))}
                  </div>
                </details>

                {/* SECTION 1: Order Details (صفحة بيانات الطلب) */}
                <section
                  id="order-details"
                  className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/50 p-5 sm:p-6 shadow-2xs space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D97757]/25 pb-3">
                    <h3 className="text-base sm:text-lg font-display font-extrabold text-[#1F1F1C] flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-[#D97757]" />
                      <span>صفحة بيانات الطلب والأطراف (Order Details)</span>
                    </h3>
                    <span className="px-2.5 py-1 rounded-lg bg-[#F5F1E8] border border-[#D97757]/40 font-mono text-xs font-bold text-[#D97757]">
                      رقم الطلب: {orderReference}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]">
                      <div className="text-[#1F1F1C]/70 mb-0.5">اسم العميل / أمين السجل:</div>
                      <div className="font-bold text-[#1F1F1C] text-sm">
                        {clientFullName}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]">
                      <div className="text-[#1F1F1C]/70 mb-0.5">
                        نقطة العرض الأساسية (اسم العائلة):
                      </div>
                      <div className="font-bold text-[#D97757] text-sm">
                        عائلة {familyName}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]">
                      <div className="text-[#1F1F1C]/70 mb-0.5">البريد الإلكتروني المعتمد:</div>
                      <div className="font-mono font-bold text-[#1F1F1C]" dir="ltr">
                        {userEmail}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]">
                      <div className="text-[#1F1F1C]/70 mb-0.5">الموطن الجغرافي المسجل:</div>
                      <div className="font-bold text-[#1F1F1C]">
                        {originCountry}
                        {originRegion ? ` — ${originRegion}` : ''}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]">
                      <div className="text-[#1F1F1C]/70 mb-0.5">المنتج محل العقد:</div>
                      <div className="font-bold text-[#1F1F1C]">
                        توثيق عمود النسب وإصدار سجل تراث العائلة (السجل الأساسي - البوابة
                        الرئيسية)
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]">
                      <div className="text-[#1F1F1C]/70 mb-0.5">الجهة المنفذة:</div>
                      <div className="font-bold text-[#1F1F1C]">
                        GeneaLab LLC (Wyoming, USA)
                      </div>
                    </div>
                  </div>
                </section>

                {/* SECTION 2: Preamble (تمهيد وبيانات الأطراف) */}
                <section
                  id="contract-preamble"
                  className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/50 p-5 sm:p-6 shadow-2xs space-y-3"
                >
                  <h3 className="text-base sm:text-lg font-display font-extrabold text-[#1F1F1C] border-b border-[#D97757]/25 pb-2.5">
                    تمهيد وبيانات الأطراف
                  </h3>
                  <div className="space-y-3 text-xs sm:text-sm text-[#1F1F1C]/90 leading-relaxed">
                    {RECORD_KEEPER_PREAMBLE.map((para, idx) => (
                      <p key={idx} className="whitespace-pre-line">
                        {para}
                      </p>
                    ))}
                  </div>
                </section>

                {/* SECTION 3: All 29 Contract Articles */}
                <div className="space-y-4">
                  {filteredArticles.length === 0 ? (
                    <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/40 p-8 text-center text-sm text-[#1F1F1C]/70">
                      لا توجد مواد مطابقة لعبارة البحث «{searchQuery}».
                    </div>
                  ) : (
                    filteredArticles.map((article) => (
                      <article
                        key={article.id}
                        id={article.id}
                        className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/45 p-5 sm:p-6 shadow-2xs space-y-3 scroll-mt-4"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-[#D97757]/20 pb-2.5">
                          <h4 className="text-sm sm:text-base font-display font-extrabold text-[#1F1F1C]">
                            <span className="text-[#D97757] ml-1.5">
                              {article.number}:
                            </span>
                            <span>{article.title}</span>
                          </h4>
                          <span className="text-[11px] font-mono text-[#D97757]/70">
                            {RECORD_KEEPER_CONTRACT_VERSION}
                          </span>
                        </div>

                        <div className="space-y-2.5 text-xs sm:text-sm text-[#1F1F1C]/90 leading-relaxed">
                          {article.paragraphs.map((p, pIdx) => (
                            <p key={pIdx} className="whitespace-pre-line">
                              {p}
                            </p>
                          ))}
                        </div>
                      </article>
                    ))
                  )}
                </div>

                {/* SECTION 4: Signatures & Audit Trail Box */}
                <section
                  id="electronic-signature-section"
                  className="rounded-2xl bg-[#F5F1E8] border-2 border-[#D97757]/50 p-5 sm:p-7 space-y-5 scroll-mt-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D97757]/35 pb-3">
                    <h3 className="text-base sm:text-lg font-display font-extrabold text-[#1F1F1C]">
                      التوقيع النهائي وسجل التدقيق وشهادة الإكمال الإلكترونية
                    </h3>
                    <span className="text-xs font-mono font-bold text-[#D97757]">
                      Audit Trail & Certificate of Completion
                    </span>
                  </div>

                  {/* Two Parties Signature Boxes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/45 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-display font-bold text-[#D97757]">
                          الطرف الأول: الجهة المنفذة
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#F5F1E8] border border-[#D8C7B2] text-[#1F1F1C] text-[11px] font-bold">
                          موقّع إلكترونيًا ✓
                        </span>
                      </div>
                      <div className="text-sm font-display font-extrabold text-[#1F1F1C]">
                        GeneaLab LLC
                      </div>
                      <p className="text-xs text-[#1F1F1C]/75 leading-relaxed">
                        30 N Gould St, STE R, Sheridan, WY 82801, USA
                        <br />
                        تم التوقيع إلكترونيًا عبر المنصة المعتمدة. وتُثبت بيانات التوقيع
                        والتحقق ضمن سجل التدقيق وشهادة الإكمال الإلكترونية.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#F5F1E8] border-2 border-[#D97757]/55 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-display font-bold text-[#D97757]">
                          الطرف الثاني: العميل / أمين السجل
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            isAlreadySigned || effectiveAudit
                              ? 'bg-[#F5F1E8] border border-[#D8C7B2] text-[#1F1F1C]'
                              : 'bg-[#F5F1E8] border border-[#D8C7B2] text-[#1F1F1C]'
                          }`}
                        >
                          {isAlreadySigned || effectiveAudit
                            ? 'تم التوقيع إلكترونيًا ✓'
                            : 'بانتظار التوقيع الإلكتروني'}
                        </span>
                      </div>
                      <div className="text-sm font-display font-extrabold text-[#1F1F1C]">
                        {clientFullName} ({userEmail})
                      </div>
                      <p className="text-xs text-[#1F1F1C]/75 leading-relaxed">
                        تم التوقيع إلكترونيًا عبر المنصة المعتمدة. وتُثبت بيانات التوقيع
                        والتحقق ضمن سجل التدقيق وشهادة الإكمال الإلكترونية.
                      </p>
                    </div>
                  </div>

                  {/* Live Audit Trail Metadata Table */}
                  <div className="rounded-xl bg-[#F5F1E8] border border-[#D97757]/40 p-4 space-y-2.5 text-xs">
                    <div className="font-display font-bold text-[#1F1F1C] flex items-center gap-2">
                      <Globe className="w-4 h-4 text-[#D97757]" />
                      <span>بيانات سجل التدقيق الإلكتروني (Electronic Audit Trail):</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px]">
                      <div className="p-2.5 rounded-lg bg-[#F5F1E8]">
                        <span className="text-[#1F1F1C]/70 block">رقم الشهادة:</span>
                        <strong className="font-mono text-[#1F1F1C]">
                          {certificateCodeDisplay}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#F5F1E8]">
                        <span className="text-[#1F1F1C]/70 block">عنوان IP والموقع:</span>
                        <strong className="font-mono text-[#1F1F1C]" dir="ltr">
                          {ipAddress || '127.0.0.1'}
                        </strong>{' '}
                        <span>({ipCountry || originCountry})</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#F5F1E8]">
                        <span className="text-[#1F1F1C]/70 block">الطابع الزمني:</span>
                        <strong className="font-mono text-[#1F1F1C]">
                          {currentTimestampDisplay}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#F5F1E8]">
                        <span className="text-[#1F1F1C]/70 block">حالة السجل القانوني:</span>
                        <strong className="text-[#1F1F1C]">
                          {isAlreadySigned || effectiveAudit
                            ? 'مكتمل ومختوم رقمياً (SEALED)'
                            : 'جاهز للاعتماد الفوري'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Mandatory Legal Consent Checkbox (Exact text from contract) */}
                  <div className="rounded-2xl bg-[#F5F1E8] border-2 border-[#1F1F1C]/20 p-4">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={agreedToElectronicSignature}
                        onChange={(e) => {
                          setAgreedToElectronicSignature(e.target.checked);
                          if (e.target.checked) setConsentError(null);
                        }}
                        className="mt-1 w-5 h-5 accent-[#D97757] rounded cursor-pointer shrink-0"
                      />
                      <span className="text-xs sm:text-sm font-display font-bold text-[#1F1F1C] leading-relaxed">
                        {RECORD_KEEPER_CONTRACT_METADATA.finalConsentCheckboxLabel}
                      </span>
                    </label>
                    {consentError && (
                      <p className="mt-2 text-xs font-bold text-[#D97757] bg-[#F5F1E8] border border-[#D8C7B2] rounded-lg px-3 py-2">
                        {consentError}
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </div>

            {/* ================================================================= */}
            {/* STICKY BOTTOM ACTION FOOTER                                       */}
            {/* ================================================================= */}
            <div className="bg-[#F5F1E8] border-t border-[#D97757]/40 px-4 sm:px-7 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 text-xs text-[#1F1F1C]/75">
                <Lock className="w-4 h-4 text-[#D97757] shrink-0" />
                <span>
                  يُحفظ هذا العقد وسجل التدقيق الإلكتروني (Audit Trail) تلقائياً في قاعدة
                  بيانات حسابك ({userEmail}).
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-[#E8DED2] hover:bg-[#D8C7B2]/60 text-[#1F1F1C] text-xs sm:text-sm font-semibold cursor-pointer"
                >
                  إغلاق
                </button>

                {isAlreadySigned ? (
                  <button
                    type="button"
                    onClick={onProceedToMyTree}
                    className="px-6 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs sm:text-sm font-display font-extrabold inline-flex items-center gap-2 shadow-md cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>العقد موقّع — الانتقال إلى شجرتي</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSigning}
                    onClick={handleSignNow}
                    className="px-6 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs sm:text-sm font-display font-extrabold inline-flex items-center gap-2 shadow-md transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <FileSignature className="w-4 h-4" />
                    <span>
                      {isSigning
                        ? 'جاري توثيق التوقيع في سجل التدقيق...'
                        : 'اعتماد التوقيع الإلكتروني وتفعيل أمين السجل ✓'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
