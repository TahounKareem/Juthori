import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  GitBranch,
  History,
  Lock,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import {
  ADAM_STAGING_SYNC_EVENT,
  AdamStagingProposalRecord,
  approveAdamStagingProposalAsMaestro,
  approveAllPendingAdamProposalsAsMaestro,
  fetchAdamStagingProposals,
  formatRelativeArabicTime,
  getAdamStagingActionMeta,
  isMaestroSovereignRole,
  rejectAdamStagingProposalAsMaestro,
} from '../services/adamSovereignFirewallService';

export interface MaestroSovereignApprovalViewProps {
  maestroName: string;
  effectiveRole: string;
  onApprovedProposalCommitted?: (proposal: AdamStagingProposalRecord) => void;
  onBackToCommandHub?: () => void;
  onOpenAdamTree?: () => void;
}

const BASE_ADAM_NODES_COUNT = 474949;

function getInitials(name?: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ب';
  if (parts.length === 1) return parts[0].slice(0, 1);
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`;
}

export const MaestroSovereignApprovalView: React.FC<
  MaestroSovereignApprovalViewProps
> = ({
  maestroName,
  effectiveRole,
  onApprovedProposalCommitted,
  onBackToCommandHub,
  onOpenAdamTree,
}) => {
  const isAuthorizedMaestro = isMaestroSovereignRole(effectiveRole);

  const [proposals, setProposals] = useState<AdamStagingProposalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [celebrationBanner, setCelebrationBanner] = useState<string | null>(
    null
  );

  const loadProposals = async () => {
    const list = await fetchAdamStagingProposals();
    setProposals(list);
    setLoading(false);
  };

  useEffect(() => {
    void loadProposals();
    const onSync = () => {
      void loadProposals();
    };
    window.addEventListener(ADAM_STAGING_SYNC_EVENT, onSync);
    return () => window.removeEventListener(ADAM_STAGING_SYNC_EVENT, onSync);
  }, []);

  const pendingProposals = useMemo(
    () => proposals.filter((p) => p.status === 'pending_maestro'),
    [proposals]
  );

  const historyProposals = useMemo(
    () => proposals.filter((p) => p.status !== 'pending_maestro'),
    [proposals]
  );

  const approvedTotalCount = useMemo(
    () => proposals.filter((p) => p.status === 'approved_by_maestro').length,
    [proposals]
  );

  const purityProgressPercent = useMemo(() => {
    const total = proposals.length;
    if (total === 0) return 100;
    const decided = historyProposals.length;
    return Math.min(100, Math.max(12, Math.round((decided / total) * 100)));
  }, [proposals.length, historyProposals.length]);

  const showCelebration = (msg: string) => {
    setCelebrationBanner(msg);
    setTimeout(() => {
      setCelebrationBanner((prev) => (prev === msg ? null : prev));
    }, 5200);
  };

  if (!isAuthorizedMaestro) {
    return (
      <div className="w-full max-w-7xl mx-auto">
        <div className="rounded-3xl bg-[#FAF7F2] border border-[#D8C7B2] p-10 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-display font-extrabold text-[#1F1F1C]">
            غرفة التصديق السيادي لشجرة آدم حصرية للمايسترو والمدير العام فقط
          </h2>
          <p className="text-xs text-[#1F1F1C]/65 max-w-lg mx-auto leading-relaxed">
            كافة اقتراحات الباحثين واعتمادات مدير البحوث تُحفظ بأمان في طبقة
            الـ Sandbox وتُعرض هنا للتصديق السيادي النهائي قبل دمجها في شجرة آدم
            الأم.
          </p>
          {onBackToCommandHub && (
            <button
              type="button"
              onClick={onBackToCommandHub}
              className="px-5 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold cursor-pointer transition-colors"
            >
              العودة إلى بوابة الإدارة الرئيسية
            </button>
          )}
        </div>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApproveSingle = async (proposal: AdamStagingProposalRecord) => {
    setProcessingId(proposal.id);
    try {
      const res = await approveAdamStagingProposalAsMaestro({
        proposal,
        maestroName,
        maestroRole: effectiveRole,
      });
      if (res.ok && res.updated) {
        setProposals((prev) =>
          prev.map((p) => (p.id === res.updated!.id ? res.updated! : p))
        );
        onApprovedProposalCommitted?.(res.updated);
        showCelebration(
          `✦ تم التصديق السيادي ودمج «${proposal.targetNodeName}» في شجرة آدم الأم بنجاح — ارتفع رصيد العقد الموثقة!`
        );
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveAll = async () => {
    if (pendingProposals.length === 0) return;
    setApprovingAll(true);
    try {
      const res = await approveAllPendingAdamProposalsAsMaestro({
        proposals,
        maestroName,
        maestroRole: effectiveRole,
      });
      if (res.ok && res.approvedCount > 0) {
        for (const p of pendingProposals) {
          onApprovedProposalCommitted?.({
            ...p,
            status: 'approved_by_maestro',
            maestroDecidedByName: maestroName,
            maestroDecidedAt: new Date().toISOString(),
          });
        }
        setProposals(res.updatedList);
        showCelebration(
          `👑 تم التصديق السيادي ودمج ${res.approvedCount} ${
            res.approvedCount === 1 ? 'تعديل مرجعي' : 'تعديلات مرجعية'
          } في شجرة آدم الأم دفعةً واحدة بنجاح ✦`
        );
      }
    } finally {
      setApprovingAll(false);
    }
  };

  const handleConfirmReject = async (proposal: AdamStagingProposalRecord) => {
    setProcessingId(proposal.id);
    try {
      const res = await rejectAdamStagingProposalAsMaestro({
        proposal,
        maestroName,
        maestroRole: effectiveRole,
        rejectionNote,
      });
      if (res.ok && res.updated) {
        setProposals((prev) =>
          prev.map((p) => (p.id === res.updated!.id ? res.updated! : p))
        );
        setRejectingId(null);
        setRejectionNote('');
        showCelebration(
          `تم ردّ التعديل المقترح على «${proposal.targetNodeName}» دون المساس بقاعدة شجرة آدم الأم.`
        );
      }
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 text-right">
      {/* =====================================================================
          1. SOVEREIGN ACHIEVEMENT & PURITY BAR (TOP ANCHOR)
      ====================================================================== */}
      <section className="rounded-3xl bg-gradient-to-l from-[#FAF6EE] via-[#FDFBF7] to-[#F5EFE4] border border-[#D8C7B2] p-6 shadow-[0_3px_20px_rgba(31,31,28,0.035)] space-y-5 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-l from-[#D97757] via-[#D8C7B2] to-transparent" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0 shadow-2xs">
              <Crown className="w-6 h-6" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#D97757] font-display font-bold">
                <span>بوابة المايسترو السيادية الحصرية</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#1F1F1C]/65">
                  جدار حماية شجرة آدم ضد الأحياء مفعّل 100%
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-display font-extrabold text-[#1F1F1C] tracking-tight">
                التصديق السيادي لإثراء شجرة آدم
              </h1>
              <p className="text-xs sm:text-[13px] text-[#1F1F1C]/65 max-w-2xl leading-relaxed">
                كافة الحلقات العمودية التاريخية والتعديلات المرجعية المراجعة من
                مدير البحوث تصل إلى هنا في بيئة آمنة بانتظار تصديقك السيادي
                بنقرة واحدة قبل دخولها شجرة آدم الأم.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onOpenAdamTree && (
              <button
                type="button"
                onClick={onOpenAdamTree}
                className="px-4 py-2.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <GitBranch className="w-4 h-4 text-[#D97757]" />
                <span>معاينة شجرة آدم</span>
              </button>
            )}

            <button
              type="button"
              disabled={approvingAll || pendingProposals.length === 0}
              onClick={handleApproveAll}
              className="px-5 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] disabled:opacity-45 text-[#F5F1E8] text-xs sm:text-[13px] font-display font-extrabold inline-flex items-center gap-2 cursor-pointer transition-all shadow-[0_4px_16px_rgba(217,119,87,0.28)]"
            >
              <CheckCheck className="w-4 h-4 shrink-0" />
              <span>
                {approvingAll
                  ? 'جارٍ التصديق والدمج الجماعي...'
                  : `✦ تأكيد وتصديق الكل بضغطة زر (${pendingProposals.length} ${
                      pendingProposals.length === 1
                        ? 'تعديل مراجع'
                        : 'تعديلات مراجعة'
                    })`}
              </span>
            </button>
          </div>
        </div>

        {/* Adam Tree Purity & Growth Progress Strip */}
        <div className="rounded-2xl bg-[#F5F1E8]/90 border border-[#D8C7B2]/80 p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 font-display font-bold text-[#1F1F1C]">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#2E5239]" />
                <span>مؤشر نقاء ونمو شجرة آدم</span>
              </span>
              <span aria-hidden="true" className="text-[#D8C7B2]">
                ·
              </span>
              <span className="tabular-nums text-[#2E5239]">
                {(BASE_ADAM_NODES_COUNT + approvedTotalCount).toLocaleString(
                  'en-US'
                )}{' '}
                عقدة تاريخية نقية
              </span>
              {approvedTotalCount > 0 && (
                <>
                  <span aria-hidden="true" className="text-[#D8C7B2]">
                    ·
                  </span>
                  <span className="text-[#D97757] tabular-nums">
                    +{approvedTotalCount} إثراء مصادق عليه
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11.5px] font-display font-bold tabular-nums text-[#1F1F1C]/75">
              <span>
                {pendingProposals.length === 0
                  ? 'الطابور صافٍ تماماً 100% ✦'
                  : `${pendingProposals.length} قيد التصديق · إنجاز ${purityProgressPercent}%`}
              </span>
            </div>
          </div>

          <div className="w-full h-2.5 rounded-full bg-[#E8DED2] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-l from-[#D97757] via-[#C8844A] to-[#2E5239] transition-all duration-500"
              style={{ width: `${purityProgressPercent}%` }}
            />
          </div>
        </div>
      </section>

      {/* Celebratory Confirmation Toast Banner */}
      {celebrationBanner && (
        <div className="rounded-2xl bg-[#FAF7F2] border border-[#2E5239]/40 px-5 py-3.5 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 text-xs sm:text-[13px] font-display font-bold text-[#2E5239]">
            <Sparkles className="w-4.5 h-4.5 text-[#D97757] shrink-0" />
            <span>{celebrationBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setCelebrationBanner(null)}
            aria-label="إغلاق التنبيه"
            className="p-1 rounded-lg hover:bg-[#E8DED2] text-[#1F1F1C]/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
          2. VIEW SEGMENTED SWITCH (PENDING FEED vs SOVEREIGN AUDIT LOG)
      ====================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#E8DED2]/75 border border-[#D8C7B2]"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'pending'}
            onClick={() => setViewMode('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-display font-bold inline-flex items-center gap-2 transition-all cursor-pointer ${
              viewMode === 'pending'
                ? 'bg-[#D97757] text-[#F5F1E8] shadow-2xs'
                : 'text-[#1F1F1C]/80 hover:bg-[#FAF7F2]/70'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>جاهز للتصديق السيادي</span>
            <span
              className={`tabular-nums font-extrabold ${
                viewMode === 'pending' ? 'text-[#F5F1E8]' : 'text-[#D97757]'
              }`}
            >
              ({pendingProposals.length})
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'history'}
            onClick={() => setViewMode('history')}
            className={`px-4 py-2 rounded-xl text-xs font-display font-bold inline-flex items-center gap-2 transition-all cursor-pointer ${
              viewMode === 'history'
                ? 'bg-[#D97757] text-[#F5F1E8] shadow-2xs'
                : 'text-[#1F1F1C]/80 hover:bg-[#FAF7F2]/70'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>سجل التصديقات السيادية السابقة</span>
            <span
              className={`tabular-nums font-extrabold ${
                viewMode === 'history' ? 'text-[#F5F1E8]' : 'text-[#1F1F1C]/65'
              }`}
            >
              ({historyProposals.length})
            </span>
          </button>
        </div>

        <p className="text-xs text-[#1F1F1C]/60">
          جميع البطاقات مفحوصة تلقائياً لاستبعاد الأحياء وحماية نقاء شجرة آدم
        </p>
      </div>

      {/* =====================================================================
          3. INSTAGRAM-INSPIRED GAMIFIED APPROVAL FEED
      ====================================================================== */}
      {loading ? (
        <div className="rounded-2xl bg-[#FAF7F2] border border-[#D8C7B2] p-10 text-center text-xs text-[#1F1F1C]/65">
          جارٍ تحميل طابور التصديق السيادي لشجرة آدم...
        </div>
      ) : viewMode === 'pending' ? (
        pendingProposals.length === 0 ? (
          <div className="rounded-3xl bg-[#FDFBF7] border border-[#D8C7B2] p-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#E8DED2] border border-[#D8C7B2] text-[#2E5239] flex items-center justify-center mx-auto">
              <CheckCheck className="w-7 h-7" />
            </div>
            <h3 className="text-base font-display font-extrabold text-[#1F1F1C]">
              لا توجد تعديلات معلقة — شجرة آدم متزامنة ونقية تماماً ✦
            </h3>
            <p className="text-xs text-[#1F1F1C]/65 max-w-md mx-auto leading-relaxed">
              عندما يضيف الباحثون أو مدير البحوث حلقات عمودية تاريخية جديدة عبر
              تذاكر العملاء أو محرر شجرة آدم في وضع الـ Sandbox، ستظهر هنا فوراً
              للتصديق بضغطة زر.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {pendingProposals.map((proposal) => {
              const actionMeta = getAdamStagingActionMeta(proposal.actionType);
              const isExpanded = expandedIds.has(proposal.id);
              const isBusy = processingId === proposal.id;
              const isRejectOpen = rejectingId === proposal.id;

              return (
                <article
                  key={proposal.id}
                  className="rounded-2xl bg-[#FDFBF7] border border-[#D8C7B2] hover:border-[#D97757]/60 shadow-[0_2px_14px_rgba(31,31,28,0.03)] transition-all overflow-hidden"
                >
                  <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Right / Main Narrative Column */}
                    <div className="space-y-2.5 min-w-0 flex-1">
                      {/* Action Type + Firewall Verification Kicker (Clean unboxed typography) */}
                      <div className="flex flex-wrap items-center gap-2 text-xs font-display font-bold">
                        <span className="text-[#D97757]">
                          {actionMeta.labelAr}
                        </span>
                        <span aria-hidden="true" className="text-[#D8C7B2]">
                          ·
                        </span>
                        <span className="text-[#2E5239] inline-flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>جد تاريخي موثق (خالي من الأحياء)</span>
                        </span>
                        {proposal.sourceFamilyName && (
                          <>
                            <span aria-hidden="true" className="text-[#D8C7B2]">
                              ·
                            </span>
                            <span className="text-[#1F1F1C]/60">
                              ملف عائلة {proposal.sourceFamilyName}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Crisp 2-Second Single Sentence Summary */}
                      <p className="text-[15px] sm:text-base font-display font-extrabold text-[#1F1F1C] leading-relaxed">
                        {proposal.summaryAr}
                      </p>

                      {/* Sleek Authentication & Provenance Strip */}
                      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 pt-1 text-xs text-[#1F1F1C]/75">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] text-[11px] font-display font-extrabold flex items-center justify-center shrink-0">
                            {getInitials(proposal.submittedByResearcherName)}
                          </span>
                          <span>
                            الباحث:{' '}
                            <strong className="text-[#1F1F1C]">
                              {proposal.submittedByResearcherName}
                            </strong>
                          </span>
                        </span>

                        {proposal.approvedByManagerName && (
                          <>
                            <span aria-hidden="true" className="text-[#D8C7B2]">
                              ·
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-[#2E5239]" />
                              <span>
                                مراجعة مدير البحوث:{' '}
                                <strong className="text-[#1F1F1C]">
                                  {proposal.approvedByManagerName}
                                </strong>
                              </span>
                            </span>
                          </>
                        )}

                        <span aria-hidden="true" className="text-[#D8C7B2]">
                          ·
                        </span>
                        <span className="inline-flex items-center gap-1 text-[#1F1F1C]/65">
                          <Clock className="w-3.5 h-3.5 text-[#D97757]/80" />
                          <span>
                            {formatRelativeArabicTime(proposal.createdAt)}
                          </span>
                        </span>

                        <span aria-hidden="true" className="text-[#D8C7B2]">
                          ·
                        </span>
                        <span className="inline-flex items-center gap-1 text-[#1F1F1C]/80 max-w-md truncate">
                          <BookOpen className="w-3.5 h-3.5 text-[#D97757] shrink-0" />
                          <span className="truncate">
                            {proposal.sourceReferenceText}
                          </span>
                        </span>
                      </div>

                      {/* Quick Expandable Node & Chain Preview Trigger */}
                      <div className="pt-0.5">
                        <button
                          type="button"
                          onClick={() => toggleExpand(proposal.id)}
                          className="inline-flex items-center gap-1.5 text-[11.5px] font-display font-bold text-[#D97757] hover:text-[#B85C3E] cursor-pointer transition-colors"
                        >
                          <span>
                            {isExpanded
                              ? 'إخفاء معاينة العقدة والمسار'
                              : 'معاينة سريعة للعقدة والأب والمصدر التراثي'}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Left: Instagram-Inspired Quick Decision Buttons (✓ Confirm | ✕ Reject) */}
                    <div className="flex items-center gap-2.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#D8C7B2]/50">
                      <button
                        type="button"
                        disabled={isBusy || approvingAll}
                        onClick={() => handleApproveSingle(proposal)}
                        className="flex-1 lg:flex-none px-5 py-2.5 rounded-full bg-[#2E5239] hover:bg-[#23412C] disabled:opacity-50 text-[#F5F1E8] text-xs sm:text-[13px] font-display font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-[0_3px_12px_rgba(46,82,57,0.22)]"
                      >
                        <Check className="w-4 h-4 stroke-[2.75]" />
                        <span>{isBusy ? 'جارٍ الدمج...' : 'تأكيد'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy || approvingAll}
                        onClick={() => {
                          if (isRejectOpen) {
                            setRejectingId(null);
                            setRejectionNote('');
                          } else {
                            setRejectingId(proposal.id);
                            setRejectionNote('');
                          }
                        }}
                        className="flex-1 lg:flex-none px-4 py-2.5 rounded-full bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] disabled:opacity-50 text-[#1F1F1C] hover:text-[#D97757] text-xs sm:text-[13px] font-display font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <X className="w-4 h-4" />
                        <span>رفض</span>
                      </button>
                    </div>
                  </div>

                  {/* Optional Quick Rejection Note Drawer */}
                  {isRejectOpen && (
                    <div className="px-5 py-3.5 bg-[#FAF6EE] border-t border-[#D8C7B2]/70 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <input
                        type="text"
                        value={rejectionNote}
                        onChange={(e) => setRejectionNote(e.target.value)}
                        placeholder="ملاحظة سريعة لمدير البحوث (اختياري)..."
                        className="flex-1 px-3.5 py-2 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] focus:border-[#D97757] text-xs text-[#1F1F1C] focus:outline-none"
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleConfirmReject(proposal)}
                          className="px-4 py-2 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold cursor-pointer transition-colors"
                        >
                          تأكيد الرفض
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId(null);
                            setRejectionNote('');
                          }}
                          className="px-3 py-2 rounded-xl bg-[#E8DED2] text-[#1F1F1C] text-xs font-bold cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quick Expandable Node & Source Preview */}
                  {isExpanded && (
                    <div className="px-5 py-4 bg-[#FAF7F2] border-t border-[#D8C7B2]/65 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="space-y-1">
                        <span className="text-[11px] font-display font-bold text-[#1F1F1C]/55 block">
                          العقدة الأم والمسار العمودي في شجرة آدم
                        </span>
                        <p className="font-display font-bold text-[#1F1F1C]">
                          {proposal.parentNodeName || 'شجرة آدم المرجعية'}
                        </p>
                        {proposal.ancestralChainPreview && (
                          <p className="text-[11.5px] text-[#D97757] leading-relaxed">
                            {proposal.ancestralChainPreview}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <span className="text-[11px] font-display font-bold text-[#1F1F1C]/55 block">
                          بيانات العقدة التاريخية المقترحة
                        </span>
                        <p className="font-display font-bold text-[#1F1F1C]">
                          {proposal.targetNodeName}
                        </p>
                        <p className="text-[11.5px] text-[#1F1F1C]/70">
                          الرمز المرجعي:{' '}
                          {proposal.proposedNodePayload?.arc_code || 'FE0'} ·
                          التمثيل:{' '}
                          {proposal.proposedNodePayload?.representation ||
                            'HISTORICAL_BRANCH'}
                        </p>
                        {proposal.proposedNodePayload?.geo_footprint &&
                          proposal.proposedNodePayload.geo_footprint.length >
                            0 && (
                            <p className="text-[11px] text-[#1F1F1C]/65">
                              النطاق الجغرافي:{' '}
                              {proposal.proposedNodePayload.geo_footprint.join(
                                '، '
                              )}
                            </p>
                          )}
                      </div>

                      <div className="space-y-1">
                        <span className="text-[11px] font-display font-bold text-[#1F1F1C]/55 block">
                          المصدر التراثي والتوثيق المعتمد
                        </span>
                        <p className="text-[#1F1F1C] leading-relaxed">
                          {proposal.sourceReferenceText}
                        </p>
                        {proposal.previousNodeSnapshot && (
                          <p className="text-[11px] text-[#1F1F1C]/60 pt-1">
                            الاسم السابق قبل التحديث:{' '}
                            {proposal.previousNodeSnapshot.name}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )
      ) : (
        /* Sovereign Audit History Log */
        <div className="rounded-2xl bg-[#FDFBF7] border border-[#D8C7B2] overflow-hidden">
          {historyProposals.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#1F1F1C]/60">
              لا توجد قرارات سيادية سابقة مسجلة بعد.
            </div>
          ) : (
            <div className="divide-y divide-[#D8C7B2]/60">
              {historyProposals.map((item) => {
                const isApproved = item.status === 'approved_by_maestro';
                const actionMeta = getAdamStagingActionMeta(item.actionType);
                return (
                  <div
                    key={item.id}
                    className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-display font-bold">
                        <span
                          className={
                            isApproved ? 'text-[#2E5239]' : 'text-[#9E2A2B]'
                          }
                        >
                          {isApproved
                            ? '✓ تم التصديق والدمج في شجرة آدم'
                            : '✕ مرفوض سيادياً'}
                        </span>
                        <span aria-hidden="true" className="text-[#D8C7B2]">
                          ·
                        </span>
                        <span className="text-[#D97757]">
                          {actionMeta.labelAr}
                        </span>
                      </div>
                      <p className="text-sm font-display font-bold text-[#1F1F1C]">
                        {item.summaryAr}
                      </p>
                      <p className="text-[11.5px] text-[#1F1F1C]/65">
                        الباحث: {item.submittedByResearcherName}
                        {item.approvedByManagerName
                          ? ` · مدير البحوث: ${item.approvedByManagerName}`
                          : ''}
                        {item.maestroDecidedByName
                          ? ` · القرار السيادي: ${item.maestroDecidedByName}`
                          : ''}
                        {' · '}
                        {formatRelativeArabicTime(
                          item.maestroDecidedAt || item.updatedAt
                        )}
                      </p>
                      {item.maestroRejectionNote && (
                        <p className="text-[11.5px] text-[#9E2A2B]">
                          ملاحظة المايسترو: {item.maestroRejectionNote}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
