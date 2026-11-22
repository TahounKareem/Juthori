import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Crown,
  Download,
  FileCheck2,
  Image as ImageIcon,
  Lock,
  Printer,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  AccountLegalType,
  DashboardAccessCapabilities,
  LineageSearchResult,
} from '../types/juthori';
import {
  BrandedExportKind,
  ExportPosterOptions,
  ExportTreeMemberSummary,
  buildOfficialExportMetadata,
  downloadHighResBrandedPng,
  extractUnlockedLineageNodesForExport,
  printOfficialBrandedDocumentViaIframe,
} from '../utils/brandedExport';
import {
  buildDeterministicQrMatrix,
  getTreeArabicFontDefinition,
} from '../utils/treeStudioConfig';

interface OfficialBrandedExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportKind: BrandedExportKind;
  result: LineageSearchResult;
  accountType: AccountLegalType;
  caps: DashboardAccessCapabilities;
  userId?: string;
  unlockedCapsules?: string[];
  treeMembers?: ExportTreeMemberSummary[];
  femalePrivacyHidden?: boolean;
  posterOptions?: ExportPosterOptions;
  onUnlockRoot5Usd?: () => void;
  onUpgradeAnnualVip?: () => void;
  onSignCharterAndEnableTree?: () => void;
  onLogExport?: (formatLabel: string, verificationId: string) => void;
}

export const OfficialBrandedExportModal: React.FC<
  OfficialBrandedExportModalProps
> = ({
  isOpen,
  onClose,
  exportKind,
  result,
  accountType,
  caps,
  userId,
  unlockedCapsules = [],
  treeMembers = [],
  femalePrivacyHidden = false,
  posterOptions,
  onUnlockRoot5Usd,
  onUpgradeAnnualVip,
  onSignCharterAndEnableTree,
  onLogExport,
}) => {
  const [downloadSuccessLabel, setDownloadSuccessLabel] = useState<string | null>(
    null
  );

  const meta = useMemo(
    () =>
      buildOfficialExportMetadata({
        result,
        accountType,
        caps,
        userId,
        exportKind,
      }),
    [result, accountType, caps, userId, exportKind]
  );

  const lineageRows = useMemo(
    () =>
      exportKind === 'lineage_spine'
        ? extractUnlockedLineageNodesForExport({
            result,
            caps,
            unlockedCapsules,
          })
        : [],
    [exportKind, result, caps, unlockedCapsules]
  );

  const previewQrMatrix = useMemo(() => {
    if (!posterOptions?.poster?.showQrCode) return null;
    const payload =
      posterOptions.verificationUrl ||
      `https://juthori.com/verify/${meta.verificationId}`;
    return buildDeterministicQrMatrix(payload, 21);
  }, [posterOptions, meta.verificationId]);

  if (!isOpen) return null;

  const isFreeRestricted = !meta.isEligibleForCertifiedExport;
  const poster = posterOptions?.poster;
  const charter = posterOptions?.lineageCharter;
  const orderedPreviewLineageRows =
    exportKind === 'lineage_spine' && charter?.direction === 'bottom_up'
      ? [...lineageRows].reverse()
      : lineageRows;
  const resolvedDocTitle =
    poster?.customTitle?.trim() ||
    (exportKind === 'lineage_spine'
      ? `صك عمود النسب الموثق — عائلة ${meta.familyName}`
      : `مستخرج المشجرة العائلية — عائلة ${meta.familyName}`);

  const handlePrintPdf = () => {
    if (isFreeRestricted) return;
    printOfficialBrandedDocumentViaIframe({
      exportKind,
      meta,
      lineageRows,
      treeMembers,
      posterOptions,
    });
    setDownloadSuccessLabel(
      `تم فتح نافذة الطباعة وحفظ ملف PDF الموثق (${meta.verificationId})`
    );
    onLogExport?.('PDF رسمي موثق', meta.verificationId);
  };

  const handleDownloadPng = () => {
    if (isFreeRestricted) return;
    downloadHighResBrandedPng({
      exportKind,
      meta,
      lineageRows,
      treeMembers,
      posterOptions,
    });
    setDownloadSuccessLabel(
      `تم تنزيل اللوحة عالية الدقة PNG بنجاح (${meta.verificationId})`
    );
    onLogExport?.('صورة عالية الدقة PNG', meta.verificationId);
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-[#252321]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="تصدير الوثيقة الرسمية الموثقة"
    >
      <div
        dir="rtl"
        className="w-full max-w-3xl rounded-3xl bg-[#FFFDF9] border-2 border-[#D4AF37] shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col text-right"
      >
        {/* Modal Top Bar */}
        <div className="px-5 sm:px-7 py-4 bg-[#252321] text-[#FAF6F0] flex items-center justify-between gap-3 border-b border-[#D4AF37]/40 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#D8755B] text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-display font-bold text-[#F3D299]">
                نظام الإصدار والتوثيق المرجعي · منصة جذوري
              </div>
              <h3 className="text-sm sm:text-lg font-display font-extrabold text-white truncate">
                {exportKind === 'lineage_spine'
                  ? `تصدير بطاقة عمود نسب عائلة ${result.familyName} الموثق`
                  : `تصدير لوحة مشجرة عائلة ${result.familyName} الموثقة`}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Official Certificate Preview */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 bg-[#FAF6F0]/70 flex-1">
          {/* Certificate Sheet Frame */}
          <div
            className="rounded-2xl p-4 sm:p-6 shadow-xs relative overflow-hidden space-y-4"
            style={{
              fontFamily:
                charter?.fontCssFamily ||
                getTreeArabicFontDefinition(posterOptions?.fontFamily).cssFamily,
              backgroundColor: charter?.sheetBg || '#FFFDF9',
              border: `2px double ${charter?.goldHex || '#8D4925'}`,
              color: charter?.textPrimaryHex || '#252321',
            }}
          >
            {isFreeRestricted && (
              <div
                aria-hidden="true"
                className="pointer-events-none select-none absolute inset-0 flex items-center justify-center opacity-[0.06] -rotate-12"
              >
                <span className="text-4xl sm:text-6xl font-display font-extrabold text-[#252321] tracking-widest">
                  معاينة · JUTHORI PREVIEW
                </span>
              </div>
            )}

            {/* Official Header */}
            <div
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4"
              style={{
                borderBottom: `1px solid ${charter?.cardStrokeHex || '#EDE6DA'}`,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl border-2 flex items-center justify-center font-display font-extrabold text-sm shrink-0"
                  style={{
                    backgroundColor: charter?.isDarkSurface ? '#0E192B' : '#252321',
                    color: '#F3D299',
                    borderColor: charter?.goldHex || '#D8755B',
                  }}
                >
                  جذوري
                </div>
                <div>
                  <div
                    className="text-[11px] font-bold"
                    style={{ color: charter?.primaryHex || '#8D4925' }}
                  >
                    منصة جذوري للأنساب العربية الموثقة · Juthori
                  </div>
                  <div
                    className="text-base sm:text-lg font-display font-extrabold"
                    style={{ color: charter?.textPrimaryHex || '#252321' }}
                  >
                    {resolvedDocTitle}
                  </div>
                  {charter && (
                    <div
                      className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold"
                      style={{ color: charter.textMutedHex }}
                    >
                      <span>الهوية: {charter.themeLabel}</span>
                      <span>·</span>
                      <span>الخط: {charter.fontLabel}</span>
                      <span>·</span>
                      <span>
                        الاتجاه:{' '}
                        {charter.direction === 'bottom_up'
                          ? 'صعوداً من أمين السجل'
                          : 'نزولاً من الجذر الأعلى'}
                      </span>
                    </div>
                  )}
                  {!charter && poster && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-[#8D4925]">
                      <span>
                        المقاس:{' '}
                        {poster.paperSize === 'A2_A1'
                          ? 'A2 / A1 جداري'
                          : poster.paperSize === 'panorama'
                          ? 'بانوراما'
                          : poster.paperSize}
                      </span>
                      <span>·</span>
                      <span>
                        البرواز:{' '}
                        {poster.borderStyle === 'islamic_gold'
                          ? 'إسلامي مذهّب'
                          : poster.borderStyle === 'classic_double'
                          ? 'كلاسيكي مزدوج'
                          : 'عصري ناعم'}
                      </span>
                      <span>·</span>
                      <span>
                        الخط:{' '}
                        {
                          getTreeArabicFontDefinition(posterOptions?.fontFamily)
                            .label
                        }
                      </span>
                      {poster.inkSaverMode && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-700">توفير الحبر للمطابع ✓</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Official Tier / Registrar Seal */}
              <div
                className={`px-3.5 py-2 rounded-xl border text-xs font-display font-extrabold inline-flex items-center gap-1.5 shrink-0 ${
                  meta.isRegistrar
                    ? 'bg-[#252321] text-[#F3D299] border-[#D4AF37] shadow-xs'
                    : meta.isEligibleForCertifiedExport
                    ? 'bg-[#FAF6F0] text-[#8D4925] border-[#8D4925]/45'
                    : 'bg-stone-100 text-stone-600 border-stone-300'
                }`}
              >
                {meta.isRegistrar ? (
                  <ShieldCheck className="w-4 h-4 text-[#F3D299] shrink-0" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-[#D8755B] shrink-0" />
                )}
                <span>{meta.membershipBadgeLabel}</span>
              </div>
            </div>

            {poster && poster.headerStyle !== 'none' && (
              <div className="rounded-xl bg-[#FAF6F0]/80 border border-[#D4AF37]/40 px-3 py-2 text-center space-y-0.5">
                <div className="text-sm font-serif font-extrabold text-[#8D4925]">
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </div>
                {poster.headerStyle === 'basmala_verse' && (
                  <div className="text-[11px] font-serif text-[#252321]/80">
                    ﴿ يَا أَيُّهَا النَّاسُ إِنَّا خَلَقْنَاكُم مِّن ذَكَرٍ وَأُنثَىٰ وَجَعَلْنَاكُمْ شُعُوبًا وَقَبَائِلَ لِتَعَارَفُوا ﴾
                  </div>
                )}
              </div>
            )}

            {exportKind === 'family_tree' && femalePrivacyHidden && (
              <div className="rounded-xl bg-[#FFF8F0] border border-[#D8755B]/45 px-3.5 py-2 flex items-center gap-2 text-xs font-display font-bold text-[#8D4925]">
                <ShieldCheck className="w-4 h-4 text-[#D8755B] shrink-0" />
                <span>
                  خيار الخصوصية العائلية «إخفاء» مفعّل — تم إخفاء أسماء الإناث من هذه النسخة عند الطباعة والتصدير.
                </span>
              </div>
            )}

            {/* Owner & Issue Metadata Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 rounded-xl bg-[#FAF6F0] border border-[#E5DCCB] p-3 text-xs">
              <div>
                <div className="text-[10px] font-bold text-[#8D4925]">
                  صاحب السجل المعتمد
                </div>
                <div className="font-display font-extrabold text-[#252321] mt-0.5">
                  {meta.ownerFullName}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#8D4925]">
                  تاريخ الإصدار الرسمي
                </div>
                <div className="font-display font-bold text-[#252321] mt-0.5">
                  {meta.hijriDate} · {meta.gregorianDate}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#8D4925]">
                  معرّف التوثيق المرجعي
                </div>
                <div
                  dir="ltr"
                  className="font-mono font-extrabold text-[#252321] mt-0.5 text-right sm:text-left"
                >
                  {meta.verificationId}
                </div>
              </div>
            </div>

            {/* Body Preview */}
            {exportKind === 'lineage_spine' ? (
              <div className="space-y-3 py-1 max-h-72 overflow-y-auto pr-1">
                {charter?.nasabNarration && (
                  <div
                    className="rounded-xl px-3.5 py-2.5 text-center space-y-1"
                    style={{
                      backgroundColor: charter.canvasBg,
                      border: `1px solid ${charter.goldHex}80`,
                    }}
                  >
                    <div
                      className="text-[10px] font-display font-bold"
                      style={{ color: charter.primaryHex }}
                    >
                      الصياغة النسبية المتصلة
                    </div>
                    <p
                      className="text-xs sm:text-sm font-bold leading-relaxed"
                      style={{ color: charter.textPrimaryHex }}
                    >
                      «{charter.nasabNarration}»
                    </p>
                  </div>
                )}

                <div
                  className="text-[11px] font-display font-bold text-center"
                  style={{ color: charter?.primaryHex || '#8D4925' }}
                >
                  معاينة المحطات المفتوحة في الصك ({orderedPreviewLineageRows.length} محطة)
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  {orderedPreviewLineageRows.map((row) => (
                    <div
                      key={row.id}
                      className="w-full max-w-md rounded-xl px-3.5 py-2 border text-right flex items-center justify-between gap-2"
                      style={{
                        backgroundColor: row.isSummit
                          ? charter?.isDarkSurface
                            ? '#1E3252'
                            : '#252321'
                          : row.isRoot
                          ? charter?.canvasBg || '#FFF8EB'
                          : charter?.isDarkSurface
                          ? '#182944'
                          : '#FFFFFF',
                        color: row.isSummit
                          ? '#FFFFFF'
                          : charter?.textPrimaryHex || '#252321',
                        borderColor: row.isSummit || row.isRoot
                          ? charter?.goldHex || '#D97706'
                          : charter?.cardStrokeHex || 'rgba(185,138,120,0.5)',
                      }}
                    >
                      <span className="text-xs sm:text-sm font-display font-extrabold truncate">
                        {row.title}
                      </span>
                      <span
                        className="text-[10px] font-bold shrink-0"
                        style={{
                          color: row.isSummit
                            ? '#F3D299'
                            : charter?.primaryHex || '#8D4925',
                        }}
                      >
                        {row.subtitle}
                      </span>
                    </div>
                  ))}
                </div>

                {charter?.verifiedSources && charter.verifiedSources.length > 0 && (
                  <div
                    className="rounded-xl p-3 space-y-1.5"
                    style={{
                      backgroundColor: charter.canvasBg,
                      border: `1px solid ${charter.cardStrokeHex}`,
                    }}
                  >
                    <div
                      className="text-[11px] font-display font-extrabold"
                      style={{ color: charter.primaryHex }}
                    >
                      ملخص المراجع التاريخية الموثقة ({charter.verifiedSources.length})
                    </div>
                    <ul className="space-y-1 text-[11px]">
                      {charter.verifiedSources.slice(0, 4).map((src, sIdx) => (
                        <li
                          key={sIdx}
                          className="truncate"
                          style={{ color: charter.textPrimaryHex }}
                        >
                          {sIdx + 1}. {src}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 py-1 max-h-64 overflow-y-auto pr-1">
                <div className="text-[11px] font-display font-bold text-[#8D4925] text-center">
                  معاينة أفراد وعُقد المشجرة في المستخرج ({treeMembers.length} عقدة)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[...treeMembers]
                    .sort((a, b) => b.generationLevel - a.generationLevel)
                    .slice(0, 14)
                    .map((member) => (
                      <div
                        key={member.id}
                        className={`rounded-xl border overflow-hidden ${
                          member.isCertifiedReference
                            ? 'bg-[#FFFBEB] border-[#D4AF37]'
                            : member.isRecordKeeper
                            ? 'bg-[#FFFDF8] border-[#C59B43]'
                            : 'bg-white border-[#B98A78]/45'
                        }`}
                      >
                        <div className="px-3 py-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-display font-extrabold text-[#252321] truncate">
                              {member.displayName}
                            </div>
                            <div className="text-[10px] text-[#8D4925] font-semibold truncate">
                              {member.relationLabel}
                            </div>
                          </div>
                          {member.isCertifiedReference && (
                            <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] border border-[#D4AF37] text-[10px] font-bold text-[#92400E] shrink-0">
                              مرجع موثق ✦
                            </span>
                          )}
                        </div>
                        {member.metaLine && (
                          <div className="px-3 py-1 bg-[#F7F1E3]/70 border-t border-[#D4AF37]/20 text-[10px] font-medium text-[#6B543E] truncate">
                            {member.metaLine}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
                {treeMembers.length > 14 && (
                  <div className="text-[11px] text-center text-[#8D4925] font-bold pt-1">
                    + {treeMembers.length - 14} فرداً إضافياً يظهرون بالكامل في ملف التصدير الرسمي
                  </div>
                )}
              </div>
            )}

            {/* Official Footer */}
            <div className="pt-3 border-t border-[#EDE6DA] flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#252321]/75">
              <span>
                {!poster || poster.showStampAndDates
                  ? 'منصة جذوري (Juthori) — ترويسة وتذييل رسميان معتمدان للحفظ والطباعة'
                  : `مشجرة عائلة ${meta.familyName}`}
              </span>
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-[#8D4925]" dir="ltr">
                  {meta.verificationId}
                </span>
                {previewQrMatrix && (
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 21 21"
                    className="rounded-md bg-white p-0.5 border border-[#D4AF37]/60 shrink-0"
                    aria-label="باركود التحقق الرسمي"
                  >
                    {previewQrMatrix.map((row, rIdx) =>
                      row.map((cell, cIdx) =>
                        cell ? (
                          <rect
                            key={`${rIdx}-${cIdx}`}
                            x={cIdx}
                            y={rIdx}
                            width={1.05}
                            height={1.05}
                            fill={posterOptions?.theme?.primaryHex || '#8D4925'}
                          />
                        ) : null
                      )
                    )}
                  </svg>
                )}
              </div>
            </div>
          </div>

          {/* Free-Tier Upgrade Governance Notice */}
          {isFreeRestricted && (
            <div
              data-testid="export-free-tier-governance-box"
              className="rounded-2xl bg-gradient-to-l from-[#FFFDF9] via-[#FEF3C7]/55 to-[#FFF8EB] border-2 border-[#D4AF37] p-4 sm:p-5 space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#252321] text-[#F3D299] flex items-center justify-center shrink-0">
                  <Crown className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs sm:text-sm font-display font-extrabold text-[#252321]">
                    التصدير الرسمي عالي الدقة بختم التوثيق المرجعي متاح للباقات الموثقة
                  </h4>
                  <p className="text-xs text-[#252321]/80 leading-relaxed">
                    لتحميل اللوحة فائقة الدقة (PNG HD) أو طباعة ملف PDF الرسمي الخالي من العلامة المائية والممهور بمعرّف التحقق وختم العضوية، يمكنك فتح الجذر الموثق ($5) أو الترقية للباقة السنوية أو عضوية أمين السجل.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {onUnlockRoot5Usd && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onUnlockRoot5Usd();
                    }}
                    className="px-4 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-extrabold cursor-pointer transition-colors"
                  >
                    فتح الجذر الموثق وتفعيل التصدير ($5)
                  </button>
                )}
                {onUpgradeAnnualVip && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onUpgradeAnnualVip();
                    }}
                    className="px-4 py-2 rounded-xl bg-[#252321] hover:bg-[#3a3734] text-[#F3D299] text-xs font-display font-extrabold cursor-pointer transition-colors"
                  >
                    الترقية للباقة السنوية VIP ($60)
                  </button>
                )}
                {onSignCharterAndEnableTree && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSignCharterAndEnableTree();
                    }}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-[#FAF6F0] border border-[#8D4925] text-[#8D4925] text-xs font-display font-bold cursor-pointer transition-colors"
                  >
                    ختم أمين سجل العائلة ✦
                  </button>
                )}
              </div>
            </div>
          )}

          {downloadSuccessLabel && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-300 px-4 py-2.5 text-xs font-bold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{downloadSuccessLabel}</span>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="px-5 sm:px-7 py-4 bg-white border-t border-[#EDE6DA] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[#F7F2E9] hover:bg-[#EDE6DA] text-xs font-display font-bold text-[#252321] cursor-pointer"
          >
            إغلاق
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isFreeRestricted}
              onClick={handleDownloadPng}
              data-testid="official-export-download-png-btn"
              className="px-4 py-2.5 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] disabled:opacity-50 disabled:cursor-not-allowed border border-[#8D4925]/50 text-[#252321] text-xs font-display font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {isFreeRestricted ? (
                <Lock className="w-3.5 h-3.5 text-[#D8755B]" />
              ) : (
                <ImageIcon className="w-4 h-4 text-[#8D4925]" />
              )}
              <span>تنزيل لوحة عالية الدقة (PNG HD)</span>
            </button>

            <button
              type="button"
              disabled={isFreeRestricted}
              onClick={handlePrintPdf}
              data-testid="official-export-print-pdf-btn"
              className="px-5 py-2.5 rounded-xl bg-[#252321] hover:bg-[#8D4925] disabled:opacity-50 disabled:cursor-not-allowed text-[#FEF3C7] text-xs font-display font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
            >
              {isFreeRestricted ? (
                <Lock className="w-3.5 h-3.5 text-[#F3D299]" />
              ) : (
                <Printer className="w-4 h-4 text-[#F3D299]" />
              )}
              <span>طباعة / حفظ ملف PDF رسمي موثق</span>
              {!isFreeRestricted && <Download className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
