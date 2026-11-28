import React, { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import {
  CircleJoinRequestDoc,
  KinshipCircleDoc,
  KinshipCircleMemberRole,
  approveCircleJoinRequest,
  rejectCircleJoinRequest,
  submitCircleJoinRequest,
} from '../services/priority4Service';
import {
  CIRCLE_PERMISSION_TIERS,
  CircleRoleKey,
  getCircleRoleTierMeta,
  normalizeCircleRoleKey,
} from '../utils/enrichmentStagingUtils';

export function formatRelativeArabicTime(isoDate?: string): string {
  if (!isoDate) return 'الآن';
  const ts = Date.parse(isoDate);
  if (Number.isNaN(ts)) return 'الآن';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 45) return 'الآن';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    if (diffMin === 1) return 'منذ دقيقة';
    if (diffMin === 2) return 'منذ دقيقتين';
    if (diffMin <= 10) return `منذ ${diffMin} دقائق`;
    return `منذ ${diffMin} دقيقة`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    if (diffHr === 1) return 'منذ ساعة';
    if (diffHr === 2) return 'منذ ساعتين';
    if (diffHr <= 10) return `منذ ${diffHr} ساعات`;
    return `منذ ${diffHr} ساعة`;
  }
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'منذ يوم';
  if (diffDay === 2) return 'منذ يومين';
  if (diffDay <= 10) return `منذ ${diffDay} أيام`;
  return `منذ ${diffDay} يوماً`;
}

function getSafeAvatarSrc(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('data:image/')
  ) {
    return trimmed;
  }
  return null;
}

function getInitialChar(name?: string): string {
  const clean = (name || '').trim();
  return clean ? clean.charAt(0) : 'ع';
}

export interface SocialJoinRequestsListProps {
  requests: CircleJoinRequestDoc[];
  ownerName?: string;
  variant?: 'full' | 'compact';
  title?: string;
  emptyText?: string;
  onApproved?: (
    request: CircleJoinRequestDoc,
    assignedRole: KinshipCircleMemberRole,
    updatedCircle: KinshipCircleDoc
  ) => void;
  onRejected?: (request: CircleJoinRequestDoc) => void;
  onError?: (message: string) => void;
}

interface CelebratedApprovalItem {
  id: string;
  requesterName: string;
  roleLabel: string;
  isUpgrade: boolean;
}

export const SocialJoinRequestsList: React.FC<SocialJoinRequestsListProps> = ({
  requests,
  ownerName,
  variant = 'full',
  title = 'طلبات الانضمام لدائرة العائلة',
  emptyText,
  onApproved,
  onRejected,
  onError,
}) => {
  const [roleByReqId, setRoleByReqId] = useState<Record<string, CircleRoleKey>>({});
  const [busyReqId, setBusyReqId] = useState<string | null>(null);
  const [celebratedItems, setCelebratedItems] = useState<CelebratedApprovalItem[]>([]);
  const [locallyDismissedIds, setLocallyDismissedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setRoleByReqId((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const req of requests) {
        if (!next[req.id]) {
          next[req.id] = normalizeCircleRoleKey(req.desiredRole);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [requests]);

  const visibleRequests = requests.filter((r) => !locallyDismissedIds[r.id]);

  if (visibleRequests.length === 0 && celebratedItems.length === 0) {
    if (!emptyText) return null;
    return (
      <div className="rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] px-4 py-3 text-xs text-[#1F1F1C]/65 text-center">
        {emptyText}
      </div>
    );
  }

  const isCompact = variant === 'compact';

  const handleConfirmApprove = async (req: CircleJoinRequestDoc) => {
    const chosenRole = normalizeCircleRoleKey(roleByReqId[req.id] || req.desiredRole);
    setBusyReqId(req.id);
    try {
      const { circle, assignedRole } = await approveCircleJoinRequest({
        request: req,
        assignedRole: chosenRole,
        ownerName,
      });
      const tierMeta = getCircleRoleTierMeta(assignedRole);
      const celebration: CelebratedApprovalItem = {
        id: req.id,
        requesterName: req.requesterName,
        roleLabel: tierMeta.labelAr,
        isUpgrade: req.requestKind === 'upgrade_permission',
      };
      setLocallyDismissedIds((prev) => ({ ...prev, [req.id]: true }));
      setCelebratedItems((prev) => [celebration, ...prev]);
      onApproved?.(req, assignedRole, circle);

      window.setTimeout(() => {
        setCelebratedItems((prev) => prev.filter((item) => item.id !== req.id));
      }, 3600);
    } catch {
      onError?.('تعذّر اعتماد طلب الانضمام حالياً، يرجى المحاولة مرة أخرى.');
    } finally {
      setBusyReqId(null);
    }
  };

  const handleDismissReject = async (req: CircleJoinRequestDoc) => {
    setBusyReqId(req.id);
    try {
      await rejectCircleJoinRequest({ request: req });
      setLocallyDismissedIds((prev) => ({ ...prev, [req.id]: true }));
      onRejected?.(req);
    } catch {
      onError?.('تعذّر حذف الطلب حالياً، يرجى المحاولة مرة أخرى.');
    } finally {
      setBusyReqId(null);
    }
  };

  return (
    <div
      className={isCompact ? 'space-y-2.5' : 'space-y-3'}
      data-testid="social-join-requests-list"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
            <UserPlus className="w-3.5 h-3.5" />
          </span>
          <h4
            className={`${
              isCompact ? 'text-xs' : 'text-[13.5px]'
            } font-display font-extrabold text-[#1F1F1C]`}
          >
            {title}
          </h4>
        </div>
        {visibleRequests.length > 0 && (
          <span className="text-[11px] font-display font-extrabold text-[#D97757] bg-[#FDFBF7] border border-[#D8C7B2] rounded-lg px-2 py-0.5 tabular-nums">
            {visibleRequests.length}{' '}
            {visibleRequests.length === 1 ? 'طلب بانتظارك' : 'طلبات بانتظارك'}
          </span>
        )}
      </div>

      {/* Celebratory instant acceptance cards */}
      {celebratedItems.map((item) => (
        <div
          key={`accepted_${item.id}`}
          className="rounded-xl bg-[#FDFBF7] border border-[#D97757]/50 px-3.5 py-3 flex items-center gap-2.5 transition-all"
        >
          <span className="w-7 h-7 rounded-full bg-[#D97757] text-[#FDFBF7] flex items-center justify-center shrink-0">
            <Check className="w-4 h-4" />
          </span>
          <p className="text-xs font-display font-bold text-[#1F1F1C] leading-relaxed">
            {item.isUpgrade
              ? `تمت ترقية صلاحية ${item.requesterName} في دائرة العائلة إلى «${item.roleLabel}» ✓`
              : `تمت إضافة ${item.requesterName} إلى دائرة العائلة بصلاحية «${item.roleLabel}» ✓`}
          </p>
        </div>
      ))}

      {/* Pending social join request cards */}
      <div className="space-y-2.5">
        {visibleRequests.map((req) => {
          const avatarSrc = getSafeAvatarSrc(req.requesterAvatarUrl);
          const selectedRole = normalizeCircleRoleKey(
            roleByReqId[req.id] || req.desiredRole
          );
          const desiredMeta = getCircleRoleTierMeta(req.desiredRole);
          const isBusy = busyReqId === req.id;

          return (
            <div
              key={req.id}
              data-testid={`join-request-card-${req.id}`}
              className={`rounded-2xl bg-[#FDFBF7] border border-[#D8C7B2] ${
                isCompact ? 'p-3 space-y-2.5' : 'p-4'
              } transition-colors hover:border-[#D97757]/55`}
            >
              <div
                className={
                  isCompact
                    ? 'space-y-2.5'
                    : 'flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5'
                }
              >
                {/* Right side: Avatar + Verified badge + Identity + Kinship note */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="relative shrink-0">
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt={req.requesterName}
                        className={`${
                          isCompact ? 'w-10 h-10' : 'w-12 h-12'
                        } rounded-full object-cover border-2 border-[#D97757]/60 bg-[#FAF7F2]`}
                      />
                    ) : (
                      <div
                        className={`${
                          isCompact ? 'w-10 h-10 text-sm' : 'w-12 h-12 text-base'
                        } rounded-full border-2 border-[#D97757]/60 bg-[#E8DED2] text-[#1F1F1C] font-display font-extrabold flex items-center justify-center`}
                      >
                        {getInitialChar(req.requesterName)}
                      </div>
                    )}
                    <span
                      title="حساب موثّق في جذوري"
                      className="absolute -bottom-0.5 -left-0.5 w-4 h-4 rounded-full bg-[#FDFBF7] text-[#D97757] flex items-center justify-center border border-[#D8C7B2]"
                    >
                      <BadgeCheck className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-[13px] font-display font-extrabold text-[#1F1F1C] truncate">
                        {req.requesterName}
                      </span>
                      {req.requestKind === 'upgrade_permission' && (
                        <span className="text-[10px] font-display font-bold text-[#D97757] bg-[#FAF7F2] border border-[#D8C7B2] rounded-md px-1.5 py-0.5">
                          ✦ طلب ترقية صلاحية
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-medium text-[#1F1F1C]/75 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span className="font-bold text-[#D97757]">{req.kinshipNote}</span>
                      <span className="text-[#D8C7B2]">·</span>
                      <span>{formatRelativeArabicTime(req.createdAt)}</span>
                      {req.requesterCountry && (
                        <>
                          <span className="text-[#D8C7B2]">·</span>
                          <span>{req.requesterCountry}</span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-[#1F1F1C]/70 leading-relaxed">
                      {desiredMeta.requestSummaryAr}
                    </p>
                  </div>
                </div>

                {/* Left side: Inline 3-tier role picker + Confirm / Delete buttons */}
                <div
                  className={`flex flex-wrap items-center gap-2 shrink-0 ${
                    isCompact ? 'pt-1 border-t border-[#E8DED2]' : ''
                  }`}
                >
                  <select
                    value={selectedRole}
                    disabled={isBusy}
                    onChange={(e) =>
                      setRoleByReqId((prev) => ({
                        ...prev,
                        [req.id]: normalizeCircleRoleKey(e.target.value),
                      }))
                    }
                    aria-label={`مستوى الصلاحية المقترح لـ ${req.requesterName}`}
                    className={`${
                      isCompact ? 'w-full text-[11px] h-8' : 'h-9 text-[11px] max-w-[235px]'
                    } rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] px-2.5 font-display font-bold text-[#1F1F1C] focus:outline-none focus:border-[#D97757] cursor-pointer`}
                  >
                    {CIRCLE_PERMISSION_TIERS.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.labelAr}
                      </option>
                    ))}
                  </select>

                  <div className={`flex items-center gap-1.5 ${isCompact ? 'w-full' : ''}`}>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleConfirmApprove(req)}
                      className={`${
                        isCompact ? 'flex-1 h-8 text-[11px]' : 'h-9 px-3.5 text-xs'
                      } rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#FDFBF7] font-display font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors whitespace-nowrap`}
                    >
                      {isBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>تأكيد القبول</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDismissReject(req)}
                      className={`${
                        isCompact ? 'h-8 px-3 text-[11px]' : 'h-9 px-3 text-xs'
                      } rounded-xl bg-[#E8DED2] hover:bg-[#D8C7B2] text-[#1F1F1C] font-display font-bold cursor-pointer disabled:opacity-60 transition-colors whitespace-nowrap`}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================
// AUTHENTICATED JOIN-CIRCLE / UPGRADE-PERMISSION MODAL (ZERO ANONYMOUS FORMS)
// =============================================================================
export interface JoinCircleRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteSlug: string;
  ownerId: string;
  familyName: string;
  mode?: 'join_circle' | 'upgrade_permission';
  currentRole?: CircleRoleKey;
  viewerUid: string;
  viewerName: string;
  viewerEmail: string;
  viewerAvatarUrl?: string;
  viewerCountry?: string;
  onSubmitted: (req: CircleJoinRequestDoc) => void;
}

const QUICK_KINSHIP_SUGGESTIONS = [
  'ابن عم / ابنة عم',
  'شقيق / شقيقة',
  'ابن خال / خال',
  'فرع العائلة',
  'صهر العائلة',
  'حفيد / حفيدة',
];

export const JoinCircleRequestModal: React.FC<JoinCircleRequestModalProps> = ({
  isOpen,
  onClose,
  siteSlug,
  ownerId,
  familyName,
  mode = 'join_circle',
  currentRole,
  viewerUid,
  viewerName,
  viewerEmail,
  viewerAvatarUrl,
  viewerCountry,
  onSubmitted,
}) => {
  const defaultDesiredRole: CircleRoleKey =
    mode === 'upgrade_permission'
      ? currentRole === 'memory_contributor'
        ? 'assistant_registrar'
        : 'memory_contributor'
      : 'family_viewer';

  const [kinshipNote, setKinshipNote] = useState('');
  const [desiredRole, setDesiredRole] = useState<CircleRoleKey>(defaultDesiredRole);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setDesiredRole(
      mode === 'upgrade_permission'
        ? currentRole === 'memory_contributor'
          ? 'assistant_registrar'
          : 'memory_contributor'
        : 'family_viewer'
    );
  }, [isOpen, mode, currentRole]);

  if (!isOpen) return null;

  const avatarSrc = getSafeAvatarSrc(viewerAvatarUrl);
  const isUpgrade = mode === 'upgrade_permission';

  const selectableTiers = isUpgrade
    ? CIRCLE_PERMISSION_TIERS.filter((t) => t.id !== 'family_viewer')
    : CIRCLE_PERMISSION_TIERS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKinship = kinshipNote.trim();
    if (!cleanKinship) {
      setErrorMsg('يرجى كتابة صلة القرابة أو الفرع العائلي لتسهيل التحقق من طلبك.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const created = await submitCircleJoinRequest({
        siteSlug,
        ownerId,
        familyName,
        requesterUid: viewerUid,
        requesterName: viewerName,
        requesterEmail: viewerEmail,
        requesterAvatarUrl: viewerAvatarUrl,
        requesterCountry: viewerCountry,
        kinshipNote: cleanKinship,
        desiredRole,
        requestKind: mode,
      });
      onSubmitted(created);
      onClose();
    } catch {
      setErrorMsg('تعذّر إرسال الطلب حالياً، يرجى التأكد من اتصالك والمحاولة مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1F1C]/45 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-circle-modal-title"
      dir="rtl"
    >
      <div className="w-full max-w-lg rounded-3xl bg-[#F5F1E8] border border-[#D8C7B2] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 bg-[#FAF7F2] border-b border-[#D8C7B2] flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FDFBF7] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
              {isUpgrade ? (
                <Sparkles className="w-5 h-5" />
              ) : (
                <UserPlus className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2
                id="join-circle-modal-title"
                className="text-base sm:text-lg font-display font-extrabold text-[#1F1F1C]"
              >
                {isUpgrade
                  ? `طلب صلاحية إثراء في ديوان عائلة ${familyName}`
                  : `طلب الانضمام لدائرة عائلة ${familyName}`}
              </h2>
              <p className="text-xs text-[#1F1F1C]/70 mt-0.5 leading-relaxed">
                {isUpgrade
                  ? 'سيصل طلبك مباشرة إلى أمين سجل العائلة لاعتماد صلاحية الإثراء لحسابك.'
                  : 'يُرسل طلبك ببيانات حسابك الموثق في جذوري ليقبله أمين السجل بنقرة واحدة.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة طلب الانضمام"
            className="w-9 h-9 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-[#1F1F1C]/70 hover:bg-[#E8DED2] hover:text-[#1F1F1C] flex items-center justify-center cursor-pointer shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Verified Juthori Identity Card (Read-only, auto-populated) */}
          <div className="rounded-2xl bg-[#FDFBF7] border border-[#D8C7B2] p-3.5 flex items-center gap-3">
            <div className="relative shrink-0">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={viewerName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#D97757]/60 bg-[#FAF7F2]"
                />
              ) : (
                <div className="w-12 h-12 rounded-full border-2 border-[#D97757]/60 bg-[#E8DED2] text-[#1F1F1C] font-display font-extrabold text-base flex items-center justify-center">
                  {getInitialChar(viewerName)}
                </div>
              )}
              <span className="absolute -bottom-0.5 -left-0.5 w-4 h-4 rounded-full bg-[#FDFBF7] text-[#D97757] flex items-center justify-center border border-[#D8C7B2]">
                <BadgeCheck className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-display font-extrabold text-[#1F1F1C] truncate">
                  {viewerName}
                </span>
                <span className="text-[10px] font-display font-bold text-[#D97757] bg-[#FAF7F2] border border-[#D8C7B2] rounded-md px-1.5 py-0.5">
                  هوية موثّقة في جذوري
                </span>
              </div>
              <div className="text-[11px] text-[#1F1F1C]/70 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                <span dir="ltr" className="font-mono">
                  {viewerEmail}
                </span>
                {viewerCountry && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#D97757]" />
                    {viewerCountry}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Field 1: Kinship relation / branch */}
          <div className="space-y-2">
            <label
              htmlFor="join-circle-kinship-input"
              className="block text-xs font-display font-extrabold text-[#1F1F1C]"
            >
              صلة القرابة / الفرع في العائلة *
            </label>
            <input
              id="join-circle-kinship-input"
              type="text"
              required
              maxLength={160}
              value={kinshipNote}
              onChange={(e) => setKinshipNote(e.target.value)}
              placeholder="مثال: ابن عمك من فرع آل صالح — الرياض"
              className="w-full h-11 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] px-3.5 text-sm text-[#1F1F1C] placeholder:text-[#1F1F1C]/40 focus:outline-none focus:border-[#D97757]"
            />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_KINSHIP_SUGGESTIONS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setKinshipNote(chip)}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-[#FAF7F2] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C]/80 cursor-pointer transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Field 2: Desired participation level (maps to 3 canonical Circle Roles) */}
          <div className="space-y-2">
            <span className="block text-xs font-display font-extrabold text-[#1F1F1C]">
              كيف تود المشاركة؟
            </span>
            <div className="space-y-2">
              {selectableTiers.map((tier) => {
                const active = desiredRole === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setDesiredRole(tier.id)}
                    className={`w-full rounded-xl p-3 border text-right transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      active
                        ? 'bg-[#FDFBF7] border-[#D97757] ring-1 ring-[#D97757]/30'
                        : 'bg-[#FAF7F2] border-[#D8C7B2] hover:border-[#D97757]/50'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-display font-extrabold text-[#1F1F1C]">
                        {tier.requestIntentLabelAr}
                      </div>
                      <div className="text-[11px] text-[#1F1F1C]/70 leading-relaxed">
                        {tier.labelAr} — {tier.descriptionAr}
                      </div>
                    </div>
                    <span
                      className={`w-4 h-4 mt-0.5 rounded-full border flex items-center justify-center shrink-0 ${
                        active
                          ? 'border-[#D97757] bg-[#D97757] text-[#FDFBF7]'
                          : 'border-[#D8C7B2] bg-[#FDFBF7]'
                      }`}
                    >
                      {active && <Check className="w-2.5 h-2.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl bg-[#FDFBF7] border border-[#D97757]/60 px-3.5 py-2.5 text-xs font-medium text-[#1F1F1C]"
            >
              {errorMsg}
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 text-[11px] text-[#1F1F1C]/65">
              <ShieldCheck className="w-3.5 h-3.5 text-[#D97757] shrink-0" />
              <span>أمين السجل يحدّد الصلاحية النهائية عند القبول</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-4 rounded-xl bg-[#E8DED2] hover:bg-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-bold cursor-pointer transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="h-10 px-5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#FDFBF7] text-xs font-display font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 transition-colors"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isUpgrade ? 'إرسال طلب الترقية' : 'إرسال طلب الانضمام'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
