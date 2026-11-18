import React, { useState, useEffect } from 'react';
import {
  Search,
  Clock,
  CheckCircle2,
  FileText,
  UserCheck,
  Send,
  Loader2,
  Scroll,
  ShieldCheck,
  Sparkles,
  Paperclip,
  MapPin,
  X,
  FolderOpen,
  MessageSquare,
  AlertCircle,
  Image as ImageIcon,
  Check,
  GitMerge,
  RefreshCw,
} from 'lucide-react';
import { auth } from '../services/firebase';
import {
  CanonicalTicketLifecycleStage,
  FamilyVaultMediaItem,
  ResearchTicketAttachmentRef,
  ResearchTicketData,
  canonicalCustomerEmailUid,
  fetchUserResearchTickets,
  fetchUserVaultArchive,
  readVaultArchiveFromLocal,
} from '../services/firestoreService';
import {
  TICKET_LIFECYCLE_STAGES,
  appendMessageToResearchTicket,
  applyResolvedTicketToCustomerLineage,
  resolveTicketLifecycleStage,
} from '../services/priority4Service';
import {
  processMediaFileForUpload,
  uploadMediaToCloudWithFallback,
} from '../utils/mediaPipeline';
import { AccountLegalType, LineageSearchResult } from '../types/juthori';
import {
  clearPendingTicketDraft,
  PendingResearchTicketDraft,
} from '../utils/handoffStorage';

interface ResearchTicketsViewProps {
  result: LineageSearchResult;
  accountType?: AccountLegalType;
  userEmail: string;
  userId?: string;
  userPhone?: string;
  isVip?: boolean;
  onRequestUpgradeVip?: () => void;
  initialDraft?: PendingResearchTicketDraft | null;
  onConsumeDraft?: () => void;
  onLogActivity?: (action: string, detail: string) => void;
  onAdoptResolvedLineage?: (enrichedResult: LineageSearchResult) => void;
  embeddedHomeWidget?: boolean;
  onOpenFullTicketsPage?: () => void;
  onTicketsStatusChange?: (status: {
    hasAnyTicket: boolean;
    hasResearcherReplyWaiting: boolean;
  }) => void;
}

export const ResearchTicketsView: React.FC<ResearchTicketsViewProps> = ({
  result,
  accountType = AccountLegalType.Individual,
  userEmail,
  userId,
  isVip = false,
  onRequestUpgradeVip,
  initialDraft,
  onConsumeDraft,
  onLogActivity,
  onAdoptResolvedLineage,
  embeddedHomeWidget = false,
  onOpenFullTicketsPage,
  onTicketsStatusChange,
}) => {
  const isFamilyRegistrar = accountType === AccountLegalType.RecordKeeper;
  const [tickets, setTickets] = useState<ResearchTicketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adoptedBannerMessage, setAdoptedBannerMessage] = useState<
    string | null
  >(null);

  const currentUid =
    userId ||
    auth.currentUser?.uid ||
    canonicalCustomerEmailUid(userEmail) ||
    `usr_${userEmail.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  // Customer Vault items for 1-click reply attachment without re-uploading
  const [vaultItems, setVaultItems] = useState<FamilyVaultMediaItem[]>(() => {
    const local = readVaultArchiveFromLocal(
      currentUid,
      result.familyName,
      userEmail
    );
    return local?.items || [];
  });
  const [vaultPickerContext, setVaultPickerContext] = useState<{
    ticketId: string;
  } | null>(null);
  const [vaultSearchQuery, setVaultSearchQuery] = useState('');

  const buildDefaultFullName = () =>
    [
      result.clientName,
      result.fatherName,
      result.grandfatherName,
      result.familyName,
    ]
      .filter((part) => part && part.trim() && part.trim() !== '—')
      .join(' ') ||
    result.familyName ||
    '';

  // Per-ticket interactive reply state
  const [replyDraftByTicket, setReplyDraftByTicket] = useState<
    Record<string, string>
  >({});
  const [replyAttachmentsByTicket, setReplyAttachmentsByTicket] = useState<
    Record<string, ResearchTicketAttachmentRef[]>
  >({});
  const [sendingReplyTicketId, setSendingReplyTicketId] = useState<
    string | null
  >(null);
  const [uploadingReplyTicketId, setUploadingReplyTicketId] = useState<
    string | null
  >(null);
  const [adoptingTicketId, setAdoptingTicketId] = useState<string | null>(null);

  useEffect(() => {
    fetchUserVaultArchive(currentUid, result.familyName, userEmail)
      .then((archive) => {
        if (archive?.items) {
          setVaultItems(archive.items);
        }
      })
      .catch(() => {});
  }, [currentUid, result.familyName, userEmail]);

  // Clear any legacy pending draft without opening a manual creation modal
  useEffect(() => {
    clearPendingTicketDraft();
    if (initialDraft) {
      onConsumeDraft?.();
    }
  }, [initialDraft, onConsumeDraft]);

  const loadTickets = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUserResearchTickets(currentUid, userEmail);
      const list = Array.isArray(data) ? data : [];
      setTickets(list);
      const waiting = list.some((t) => {
        if (t.status === 'NEEDS_INFO' || t.lifecycleStage === 'NEEDS_INFO') {
          return true;
        }
        const msgs = t.messages || [];
        const lastMsg = msgs[msgs.length - 1];
        return Boolean(lastMsg && lastMsg.senderRole === 'researcher');
      });
      onTicketsStatusChange?.({
        hasAnyTicket: list.length > 0,
        hasResearcherReplyWaiting: waiting,
      });
    } catch {
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [currentUid, userEmail]);

  // Smart Media Pipeline upload for Reply to Researcher
  const handleSmartUploadAttachment = async (
    file: File | undefined,
    target: { ticketId: string }
  ) => {
    if (!file) return;
    setUploadingReplyTicketId(target.ticketId);

    try {
      const isDoc =
        file.type === 'application/pdf' ||
        /\.(pdf|doc|docx)$/i.test(file.name);
      const processed = await processMediaFileForUpload(
        file,
        isDoc ? 'vault_document' : 'vault_photo'
      );
      const itemId = `tkt_att_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const uploaded = await uploadMediaToCloudWithFallback({
        uid: currentUid,
        category: 'vault',
        itemId,
        mainDataUrl: processed.mainDataUrl,
        thumbnailDataUrl: processed.thumbnailDataUrl,
        mimeType: processed.mimeType,
      });

      const refItem: ResearchTicketAttachmentRef = {
        id: itemId,
        title: file.name.slice(0, 120),
        mediaType: isDoc ? 'document' : 'photo',
        sourceType: 'direct_upload',
        thumbnailUrl:
          uploaded.thumbnailUrl && uploaded.thumbnailUrl.length <= 95000
            ? uploaded.thumbnailUrl
            : undefined,
        fileUrl:
          uploaded.url.startsWith('https://') || uploaded.url.length <= 120000
            ? uploaded.url
            : uploaded.thumbnailUrl,
        dateOrOccasion: 'مرفق مباشر عبر المعالج الذكي',
      };

      setReplyAttachmentsByTicket((prev) => ({
        ...prev,
        [target.ticketId]: [
          ...(prev[target.ticketId] || []),
          refItem,
        ].slice(0, 10),
      }));
    } catch {
      // Safe fallback
    } finally {
      setUploadingReplyTicketId(null);
    }
  };

  const toggleVaultAttachmentSelection = (vaultItem: FamilyVaultMediaItem) => {
    if (!vaultPickerContext) return;
    const mappedRef: ResearchTicketAttachmentRef = {
      id: `vref_${vaultItem.id}`,
      vaultItemId: vaultItem.id,
      title: vaultItem.title || 'وثيقة من خزانتي',
      mediaType: vaultItem.mediaType === 'document' ? 'document' : 'photo',
      sourceType: 'vault_ref',
      thumbnailUrl:
        vaultItem.thumbnailDataUrl &&
        vaultItem.thumbnailDataUrl.length <= 95000
          ? vaultItem.thumbnailDataUrl
          : vaultItem.fileDataUrl?.startsWith('https://')
          ? vaultItem.fileDataUrl
          : undefined,
      fileUrl: vaultItem.fileDataUrl?.startsWith('https://')
        ? vaultItem.fileDataUrl
        : vaultItem.thumbnailDataUrl,
      dateOrOccasion: vaultItem.dateOrOccasion || 'محفوظ في خزانتي',
    };

    const tid = vaultPickerContext.ticketId;
    setReplyAttachmentsByTicket((prev) => {
      const current = prev[tid] || [];
      const exists = current.some((a) => a.vaultItemId === vaultItem.id);
      return {
        ...prev,
        [tid]: exists
          ? current.filter((a) => a.vaultItemId !== vaultItem.id)
          : [...current, mappedRef].slice(0, 10),
      };
    });
  };

  const handleSendCustomerReply = async (ticket: ResearchTicketData) => {
    const draftBody = (replyDraftByTicket[ticket.id] || '').trim();
    const pendingAtts = replyAttachmentsByTicket[ticket.id] || [];
    if (!draftBody && pendingAtts.length === 0) return;

    setSendingReplyTicketId(ticket.id);
    try {
      const savedMsg = await appendMessageToResearchTicket({
        ticketId: ticket.id,
        senderRole: 'customer',
        senderId: currentUid,
        senderName: ticket.userFullName || buildDefaultFullName(),
        body: draftBody,
        attachments: pendingAtts,
      });

      if (savedMsg) {
        const currentStage = resolveTicketLifecycleStage(ticket);
        const nextStage: CanonicalTicketLifecycleStage =
          currentStage === 'NEEDS_INFO' ? 'IN_REVIEW' : currentStage;
        setTickets((prev) => {
          const nextList = prev.map((t) =>
            t.id === ticket.id
              ? {
                  ...t,
                  status: nextStage,
                  lifecycleStage: nextStage,
                  messages: [...(t.messages || []), savedMsg],
                  attachments: [
                    ...(t.attachments || []),
                    ...pendingAtts,
                  ].slice(-25),
                  updatedAt: savedMsg.createdAt,
                }
              : t
          );
          const waiting = nextList.some((t) => {
            if (t.status === 'NEEDS_INFO' || t.lifecycleStage === 'NEEDS_INFO') {
              return true;
            }
            const msgs = t.messages || [];
            const lastMsg = msgs[msgs.length - 1];
            return Boolean(lastMsg && lastMsg.senderRole === 'researcher');
          });
          onTicketsStatusChange?.({
            hasAnyTicket: nextList.length > 0,
            hasResearcherReplyWaiting: waiting,
          });
          return nextList;
        });
        setReplyDraftByTicket((prev) => ({ ...prev, [ticket.id]: '' }));
        setReplyAttachmentsByTicket((prev) => ({ ...prev, [ticket.id]: [] }));
        onLogActivity?.(
          'إرسال توضيح في مرصد البحوث',
          `إضافة رد ومرفقات على التذكرة #${ticket.ticketNumber}`
        );
      }
    } finally {
      setSendingReplyTicketId(null);
    }
  };

  const handleAdoptResolution = async (ticket: ResearchTicketData) => {
    if (adoptingTicketId) return;
    setAdoptingTicketId(ticket.id);
    try {
      const outcome = await applyResolvedTicketToCustomerLineage({
        ticket,
        currentResult: result,
        userId: currentUid,
        userEmail,
      });

      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticket.id
            ? {
                ...t,
                resolutionPayload: {
                  decisionTitle:
                    t.resolutionPayload?.decisionTitle ||
                    `توثيق مرجعي معتمد — #${t.ticketNumber}`,
                  ...(t.resolutionPayload || {}),
                  appliedByCustomerAt: outcome.appliedAt,
                },
              }
            : t
        )
      );

      onAdoptResolvedLineage?.(outcome.enrichedResult);
      setAdoptedBannerMessage(
        outcome.alreadyApplied
          ? `تم اعتماد ودمج قرار التذكرة (#${ticket.ticketNumber}) مسبقاً في عمود نسبك الموثق ✓`
          : `تم اعتماد ودمج النتيجة الموثقة للتذكرة (#${ticket.ticketNumber}) في «عمود نسبي» و«مشجرتي» بنجاح ✓`
      );
      onLogActivity?.(
        'اعتماد ودمج نتيجة مرصد البحوث',
        `دمج التوثيق المعتمد من التذكرة #${ticket.ticketNumber} (${outcome.enrichedResult.rootBranchName} ⬅️ ${outcome.enrichedResult.rootTribeName})`
      );
    } finally {
      setAdoptingTicketId(null);
    }
  };

  const getStagePresentation = (stage: CanonicalTicketLifecycleStage) => {
    switch (stage) {
      case 'OPEN':
        return {
          code: 'OPEN',
          label: 'مستلمة (OPEN)',
          color: 'bg-amber-50 text-amber-900 border-amber-300',
          stepIndex: 0,
        };
      case 'IN_REVIEW':
        return {
          code: 'IN_REVIEW',
          label: 'قيد الفحص المرجعي (IN_REVIEW)',
          color: 'bg-sky-50 text-sky-900 border-sky-300',
          stepIndex: 1,
        };
      case 'NEEDS_INFO':
        return {
          code: 'NEEDS_INFO',
          label: 'بانتظار استكمال بيانات من العميل (NEEDS_INFO)',
          color: 'bg-orange-100 text-orange-950 border-orange-400',
          stepIndex: 2,
        };
      case 'RESOLVED':
        return {
          code: 'RESOLVED',
          label: 'معتمدة وموثقة (RESOLVED)',
          color: 'bg-emerald-100 text-emerald-950 border-emerald-400',
          stepIndex: 3,
        };
      case 'CLOSED':
        return {
          code: 'CLOSED',
          label: 'مغلقة (CLOSED)',
          color: 'bg-stone-100 text-stone-800 border-stone-300',
          stepIndex: 4,
        };
    }
  };

  const filteredVaultItems = vaultItems.filter((item) => {
    const q = vaultSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (item.title || '').toLowerCase().includes(q) ||
      (item.dateOrOccasion || '').toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q)
    );
  });

  const activeVaultSelectedIds = new Set(
    (vaultPickerContext
      ? replyAttachmentsByTicket[vaultPickerContext.ticketId] || []
      : []
    )
      .map((a) => a.vaultItemId)
      .filter(Boolean)
  );

  const displayedTickets = embeddedHomeWidget
    ? tickets.filter((t) => {
        const st = resolveTicketLifecycleStage(t);
        if (st === 'CLOSED') return false;
        if (st === 'RESOLVED' && t.resolutionPayload?.appliedByCustomerAt) {
          return false;
        }
        return true;
      })
    : tickets;

  if (embeddedHomeWidget && (isLoading || displayedTickets.length === 0)) {
    return null;
  }

  return (
    <div
      data-testid={
        embeddedHomeWidget
          ? 'home-active-research-ticket-box'
          : 'full-research-tickets-view'
      }
      className={
        embeddedHomeWidget
          ? 'rounded-2xl bg-[#FAF6F0] border-2 border-[#B98A78]/50 p-5 sm:p-6 space-y-5 text-[#252321]'
          : 'space-y-6 text-[#252321]'
      }
    >
      {adoptedBannerMessage && (
        <div className="rounded-2xl bg-[#FFFDF9] border-2 border-[#D4AF37] p-4 sm:p-5 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#8D4925] text-[#F3D299] flex items-center justify-center shrink-0">
              <GitMerge className="w-5 h-5" />
            </div>
            <div className="text-xs sm:text-sm font-display font-extrabold text-[#252321]">
              {adoptedBannerMessage}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAdoptedBannerMessage(null)}
            className="p-1.5 rounded-lg hover:bg-[#EDE6DA] text-[#252321] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Header Banner */}
      {embeddedHomeWidget ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#B98A78]/30">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#D8755B]/15 text-[#D8755B] text-xs font-display font-bold">
                <Scroll className="w-3.5 h-3.5" />
                <span>تذكرتك البحثية الجارية في مرصد البحوث</span>
              </span>
              {isFamilyRegistrar && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FEF3C7] border border-[#D4AF37] text-[11px] font-display font-bold text-[#8D4925]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#D97706]" />
                  <span>أولوية أمين السجل · PRIORITY_REGISTRAR</span>
                </span>
              )}
            </div>
            <p className="text-xs text-[#252321]/75">
              متابعة فورية لمراحل تحقيق وتوثيق عمود النسب والرد المباشر على الباحث المختص أو إرفاق وثائق من «خزانتي».
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadTickets}
              disabled={isLoading}
              className="px-3 py-2 rounded-xl bg-white hover:bg-[#EDE6DA] text-[#8D4925] border border-[#B98A78]/45 text-xs font-display font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              />
              <span>تحديث</span>
            </button>
            {onOpenFullTicketsPage && (
              <button
                type="button"
                onClick={onOpenFullTicketsPage}
                className="px-3.5 py-2 rounded-xl bg-[#252321] hover:bg-[#3a3633] text-[#F3D299] text-xs font-display font-bold transition-colors cursor-pointer"
              >
                فتح صفحة مرصد البحوث كاملة ←
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-[#B98A78]/30 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#D8755B]/15 text-[#D8755B] text-xs font-semibold">
                <Scroll className="w-3.5 h-3.5" />
                <span>متابعة طلب تحقيق النسب ومراسلات الباحثين</span>
              </div>
              {isFamilyRegistrar && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FEF3C7] border border-[#D4AF37] text-xs font-display font-bold text-[#8D4925]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#D97706]" />
                  <span>أولوية أمين السجل مفعّلة · PRIORITY_REGISTRAR</span>
                </span>
              )}
            </div>
            <h2 className="text-xl font-display font-bold text-[#252321]">
              مرصد البحوث وتذاكر التحقيق الجينيالوجي
            </h2>
            <p className="text-xs sm:text-sm text-[#252321]/75 max-w-2xl leading-relaxed">
              هذه الصفحة مخصصة لمتابعة مراحل طلب تحقيق وتوثيق نسب عائلتك ضمن الاشتراك السنوي، والرد على استفسارات ومراسلات فريق الباحثين أو إرفاق وثائق مساندة من «خزانتي»، واعتماد النتيجة الموثقة فور صدورها.
            </p>
          </div>

          <button
            type="button"
            onClick={loadTickets}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] text-[#8D4925] border border-[#B98A78]/45 text-xs sm:text-sm font-display font-bold flex items-center gap-2 transition-colors cursor-pointer shrink-0 shadow-2xs disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>تحديث الحالة والمراسلات</span>
          </button>
        </div>
      )}

      {/* 2. Active Tickets List */}
      {isLoading ? (
        <div className="rounded-2xl bg-white border border-[#B98A78]/30 p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D8755B] mb-3" />
          <p className="text-sm text-[#252321]/70">
            جاري تحميل حالة طلب تحقيق النسب ومراسلات الباحثين...
          </p>
        </div>
      ) : displayedTickets.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[#B98A78]/30 p-8 text-center space-y-3.5">
          <div className="w-12 h-12 rounded-full bg-[#EDE6DA] mx-auto flex items-center justify-center text-[#8D4925]">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="font-display font-bold text-base text-[#252321]">
            لا يوجد طلب تحقيق نسبي مفتوح تحت المتابعة حالياً
          </h3>
          <p className="text-xs text-[#252321]/75 max-w-lg mx-auto leading-relaxed">
            {isVip
              ? `يُفتح طلب التحقيق الأرشيفي تلقائياً من قِبل النظام عند الاشتراك في الباقة السنوية للعائلات التي تتطلب فحصاً وتحقيقاً في المخطوطات وأمهات الكتب، وتظهر هنا كافة المراسلات والتحديثات فور إحالتها من فريق الباحثين.`
              : `تُفتح طلبات التحقيق النَّسبي المتخصص تلقائياً لمشتركي الباقة السنوية عندما تتطلب العائلة فحصاً وتوثيقاً من فريق الباحثين في أرشيف المخطوطات وأمهات الكتب.`}
          </p>
          {!isVip && onRequestUpgradeVip && (
            <button
              type="button"
              onClick={onRequestUpgradeVip}
              className="px-5 py-2.5 rounded-xl bg-[#252321] hover:bg-[#8D4925] text-[#FEF3C7] text-xs font-display font-bold transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <span>الترقية إلى الباقة السنوية لتوثيق عمود النسب ←</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {displayedTickets.map((ticket) => {
            const stage = resolveTicketLifecycleStage(ticket);
            const pres = getStagePresentation(stage);
            const canReplyInThread =
              stage === 'OPEN' ||
              stage === 'IN_REVIEW' ||
              stage === 'NEEDS_INFO';
            const pendingReplyAttachments =
              replyAttachmentsByTicket[ticket.id] || [];
            const hasResolutionToAdopt =
              stage === 'RESOLVED' &&
              Boolean(
                ticket.resolutionPayload ||
                  ticket.researchFindings ||
                  ticket.verifiedSources
              );
            const isAlreadyAdopted = Boolean(
              ticket.resolutionPayload?.appliedByCustomerAt
            );

            return (
              <div
                key={ticket.id}
                data-testid={`research-ticket-card-${ticket.id}`}
                className="rounded-2xl bg-white border border-[#B98A78]/40 p-5 sm:p-6 shadow-xs space-y-4"
              >
                {/* Top Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/20 pb-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-lg bg-[#252321] text-white font-mono text-xs font-bold">
                      #{ticket.ticketNumber}
                    </span>
                    <h3 className="font-display font-bold text-base text-[#252321]">
                      طلب تحقيق نسب: {ticket.targetAncestor}
                    </h3>
                    {(ticket.priorityTag === 'PRIORITY_REGISTRAR' ||
                      isFamilyRegistrar) && (
                      <span
                        data-testid="priority-registrar-badge"
                        className="px-2.5 py-0.5 rounded-lg bg-[#FEF3C7] border border-[#D4AF37] text-[11px] font-display font-bold text-[#8D4925]"
                      >
                        PRIORITY_REGISTRAR · أولوية أمين السجل ✦
                      </span>
                    )}
                    {ticket.verificationChoiceLabel && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-[#FAF6F0] border border-[#B98A78]/40 text-[11px] font-semibold text-[#8D4925]">
                        {ticket.verificationChoiceLabel}
                      </span>
                    )}
                  </div>

                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-display font-bold border ${pres.color} inline-flex items-center gap-1.5`}
                  >
                    {stage === 'RESOLVED' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    ) : stage === 'NEEDS_INFO' ? (
                      <AlertCircle className="w-3.5 h-3.5 text-orange-700" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                    <span>{pres.label}</span>
                  </span>
                </div>

                {/* 5-Stage Visual Lifecycle Stepper (OPEN -> IN_REVIEW -> NEEDS_INFO -> RESOLVED -> CLOSED) */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 pb-2">
                  {TICKET_LIFECYCLE_STAGES.map((st, idx) => {
                    const isCurrent = stage === st.stage;
                    const isPassed =
                      stage === 'CLOSED'
                        ? true
                        : stage === 'RESOLVED'
                        ? idx <= 3 && st.stage !== 'NEEDS_INFO'
                        : idx < pres.stepIndex && st.stage !== 'NEEDS_INFO';
                    const barClass = isCurrent
                      ? st.stage === 'NEEDS_INFO'
                        ? 'bg-orange-500'
                        : st.stage === 'RESOLVED'
                        ? 'bg-emerald-600'
                        : 'bg-[#D8755B]'
                      : isPassed
                      ? 'bg-[#2E7D32]'
                      : 'bg-[#EDE6DA]';

                    return (
                      <div
                        key={st.stage}
                        className={`rounded-xl p-2 border text-right transition-colors ${
                          isCurrent
                            ? 'bg-[#FAF6F0] border-[#D8755B]/60'
                            : 'bg-white border-[#B98A78]/20'
                        }`}
                      >
                        <div
                          className={`h-1.5 rounded-full mb-1.5 ${barClass}`}
                        />
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-[11px] font-display font-bold ${
                              isCurrent
                                ? 'text-[#252321]'
                                : isPassed
                                ? 'text-[#2E7D32]'
                                : 'text-[#252321]/45'
                            }`}
                          >
                            {st.shortAr}
                          </span>
                          <span className="text-[9px] font-mono text-[#8D4925]/80">
                            {st.stage}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* NEEDS_INFO Callout Banner */}
                {stage === 'NEEDS_INFO' && (
                  <div className="rounded-xl bg-orange-50 border-2 border-orange-300 p-3.5 flex items-start gap-2.5 text-xs text-orange-950">
                    <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-display block mb-0.5">
                        بانتظار استكمال بيانات أو مرفقات مساندة من قِبلك
                      </strong>
                      <span>
                        أرسل التوضيح المطلوب أو أرفق وثيقة من «خزانتي» عبر صندوق المراسلة أدناه ليُستأنف الفحص المرجعي تلقائياً.
                      </span>
                    </div>
                  </div>
                )}

                {/* Ticket Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs bg-[#F7F2E9] p-4 rounded-xl">
                  <div>
                    <span className="text-[#252321]/60 block mb-0.5">
                      القبيلة والفرع المستهدف:
                    </span>
                    <strong className="text-[#252321]">
                      {ticket.tribeName || 'غير محدد'}{' '}
                      {ticket.familyBranch ? `— ${ticket.familyBranch}` : ''}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#252321]/60 block mb-0.5">
                      البلد / المدينة والمركز:
                    </span>
                    <strong className="text-[#252321] inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#D8755B]" />
                      <span>
                        {ticket.originCountry || 'السعودية'}
                        {ticket.originRegion ? ` · ${ticket.originRegion}` : ''}
                      </span>
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#252321]/60 block mb-0.5">
                      الباحث الجينيالوجي المسؤول:
                    </span>
                    <strong className="text-[#D8755B] flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>
                        {ticket.assignedResearcherName ||
                          'قيد التوزيع على باحث مختص'}
                      </span>
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#252321]/60 block mb-0.5">
                      تاريخ فتح الطلب:
                    </span>
                    <strong className="text-[#252321]">
                      {new Date(ticket.openedAt).toLocaleDateString('ar-SA')}
                    </strong>
                  </div>
                </div>

                {/* Attached Vault / Smart Media References */}
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <div className="rounded-xl bg-[#FAF6F0] border border-[#B98A78]/35 p-3.5 space-y-2">
                    <div className="text-xs font-display font-bold text-[#8D4925] flex items-center gap-1.5">
                      <FolderOpen className="w-3.5 h-3.5 text-[#D8755B]" />
                      <span>
                        الوثائق المساندة المرفقة بالتذكرة ({ticket.attachments.length}):
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ticket.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="inline-flex items-center gap-2 rounded-xl bg-white border border-[#B98A78]/35 px-2.5 py-1.5 text-xs"
                        >
                          {att.thumbnailUrl ? (
                            <img
                              src={att.thumbnailUrl}
                              alt={att.title}
                              className="w-8 h-8 rounded-lg object-cover border border-[#B98A78]/30 shrink-0"
                            />
                          ) : (
                            <FileText className="w-4 h-4 text-[#8D4925] shrink-0" />
                          )}
                          <div>
                            <div className="font-bold text-[#252321] line-clamp-1 max-w-[180px]">
                              {att.title}
                            </div>
                            <div className="text-[10px] text-[#8D4925]">
                              {att.sourceType === 'vault_ref'
                                ? 'مرجع من خزانتي'
                                : 'مرفق ذكي'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* RESOLVED Decision & 1-Click Adoption into Spine & Tree */}
                {hasResolutionToAdopt && (
                  <div className="rounded-2xl border-2 border-emerald-500/80 bg-gradient-to-br from-emerald-50/90 via-white to-[#FAF6F0] p-4 sm:p-5 space-y-3 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-emerald-950 font-display font-extrabold text-sm sm:text-base">
                        <ShieldCheck className="w-5 h-5 text-emerald-700" />
                        <span>
                          {ticket.resolutionPayload?.decisionTitle ||
                            'قرار التوثيق المرجعي المعتمد من مرصد البحوث'}
                        </span>
                      </div>
                      {isAlreadyAdopted && (
                        <span className="px-3 py-1 rounded-lg bg-emerald-700 text-white text-[11px] font-display font-bold">
                          تم الاعتماد والدمج في حسابك ✓
                        </span>
                      )}
                    </div>

                    {(ticket.resolutionPayload?.summaryNotes ||
                      ticket.researchFindings) && (
                      <p className="text-xs text-emerald-950 leading-relaxed">
                        {ticket.resolutionPayload?.summaryNotes ||
                          ticket.researchFindings}
                      </p>
                    )}

                    {(ticket.resolutionPayload?.verifiedRootBranch ||
                      ticket.resolutionPayload?.verifiedRootTribe ||
                      ticket.resolutionPayload?.certifiedAncestorName) && (
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#8D4925] bg-white px-3 py-2 rounded-xl border border-emerald-300">
                        {ticket.resolutionPayload?.certifiedAncestorName && (
                          <span>
                            الجد المرجعي:{' '}
                            <strong>
                              {ticket.resolutionPayload.certifiedAncestorName}
                            </strong>
                          </span>
                        )}
                        {ticket.resolutionPayload?.verifiedRootBranch && (
                          <span>
                            · الفرع الموثق:{' '}
                            <strong>
                              {ticket.resolutionPayload.verifiedRootBranch}
                            </strong>
                          </span>
                        )}
                        {ticket.resolutionPayload?.verifiedRootTribe && (
                          <span>
                            · القبيلة الأم:{' '}
                            <strong>
                              {ticket.resolutionPayload.verifiedRootTribe}
                            </strong>
                          </span>
                        )}
                      </div>
                    )}

                    {(ticket.resolutionPayload?.verifiedCitation ||
                      ticket.verifiedSources) && (
                      <div className="text-[11px] text-emerald-900/90 pt-1 border-t border-emerald-200">
                        <strong>المصادر والوثائق المعتمدة:</strong>{' '}
                        {ticket.resolutionPayload?.verifiedCitation ||
                          ticket.verifiedSources}
                      </div>
                    )}

                    <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[11px] text-[#252321]/70">
                        يحدّث هذا الإجراء لقطة `verifiedLineageSnapshot` ذرياً لتنعكس فوراً في «عمود نسبي» وجسر «مشجرتي».
                      </span>
                      <button
                        type="button"
                        data-testid={`adopt-ticket-resolution-btn-${ticket.id}`}
                        disabled={adoptingTicketId === ticket.id}
                        onClick={() => handleAdoptResolution(ticket)}
                        className="px-4 py-2.5 rounded-xl bg-[#252321] hover:bg-[#3a3633] text-[#F3D299] text-xs font-display font-extrabold inline-flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-60 shadow-xs"
                      >
                        {adoptingTicketId === ticket.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <GitMerge className="w-4 h-4 text-[#D8755B]" />
                        )}
                        <span>
                          {isAlreadyAdopted
                            ? 'تحديث ومزامنة الدمج في عمود نسبي / مشجرتي ✓'
                            : 'اعتماد ودمج النتيجة في عمود نسبي / مشجرتي'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Interactive Message Thread (`messages`) */}
                <div className="rounded-2xl bg-[#F7F2E9]/90 border border-[#B98A78]/35 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-display font-bold text-[#252321]">
                      <MessageSquare className="w-4 h-4 text-[#D8755B]" />
                      <span>
                        سجل المراسلات والتوضيحات المرجعية ({ticket.messages?.length || 0})
                      </span>
                    </div>
                    <span className="text-[11px] text-[#252321]/60">
                      متزامن سحابياً في Firestore
                    </span>
                  </div>

                  {ticket.messages && ticket.messages.length > 0 ? (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {ticket.messages.map((msg) => {
                        const isResearcher = msg.senderRole === 'researcher';
                        return (
                          <div
                            key={msg.id}
                            className={`rounded-xl p-3 text-xs border ${
                              isResearcher
                                ? 'bg-[#FFFDF9] border-[#D4AF37]/70'
                                : 'bg-white border-[#B98A78]/30'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-display font-bold text-[#252321]">
                                {msg.senderName}{' '}
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-md mr-1 ${
                                    isResearcher
                                      ? 'bg-[#8D4925] text-white'
                                      : 'bg-[#EDE6DA] text-[#8D4925]'
                                  }`}
                                >
                                  {isResearcher ? 'باحث المرصد' : 'صاحب الطلب'}
                                </span>
                              </span>
                              <span className="text-[10px] text-[#252321]/55">
                                {new Date(msg.createdAt).toLocaleString('ar-SA')}
                              </span>
                            </div>
                            <p className="text-[#252321]/85 leading-relaxed">
                              {msg.body}
                            </p>
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-[#B98A78]/20">
                                {msg.attachments.map((att) => (
                                  <span
                                    key={att.id}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#FAF6F0] border border-[#B98A78]/30 text-[11px] font-semibold text-[#8D4925]"
                                  >
                                    <Paperclip className="w-3 h-3 text-[#D8755B]" />
                                    <span>{att.title}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-[#252321]/65">
                      {ticket.additionalNotes ||
                        'لا توجد رسائل إضافية بعد. يمكنك إضافة أي توضيح أو وثيقة مساندة أدناه.'}
                    </p>
                  )}

                  {/* Customer Reply Composer when OPEN / IN_REVIEW / NEEDS_INFO */}
                  {canReplyInThread && (
                    <div className="pt-2 border-t border-[#B98A78]/25 space-y-2.5">
                      {pendingReplyAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {pendingReplyAttachments.map((att) => (
                            <span
                              key={att.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#D8755B]/50 text-[11px] font-bold text-[#252321]"
                            >
                              <span>📎 {att.title}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setReplyAttachmentsByTicket((prev) => ({
                                    ...prev,
                                    [ticket.id]: (prev[ticket.id] || []).filter(
                                      (x) => x.id !== att.id
                                    ),
                                  }))
                                }
                                className="text-[#D8755B] hover:text-red-600 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={replyDraftByTicket[ticket.id] || ''}
                          onChange={(e) =>
                            setReplyDraftByTicket((prev) => ({
                              ...prev,
                              [ticket.id]: e.target.value,
                            }))
                          }
                          placeholder="أضف توضيحاً نسبياً أو رداً للباحث المختص..."
                          className="flex-1 rounded-xl bg-white border border-[#B98A78]/50 px-3.5 py-2 text-xs text-[#252321] focus:outline-none focus:border-[#D8755B]"
                        />

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setVaultPickerContext({ ticketId: ticket.id })
                            }
                            className="px-3 py-2 rounded-xl bg-white hover:bg-[#EDE6DA] border border-[#B98A78]/50 text-[11px] font-display font-bold text-[#8D4925] inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <FolderOpen className="w-3.5 h-3.5 text-[#D8755B]" />
                            <span>من خزانتي</span>
                          </button>

                          <label className="px-3 py-2 rounded-xl bg-white hover:bg-[#EDE6DA] border border-[#B98A78]/50 text-[11px] font-display font-bold text-[#252321] inline-flex items-center gap-1.5 cursor-pointer">
                            {uploadingReplyTicketId === ticket.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D8755B]" />
                            ) : (
                              <Paperclip className="w-3.5 h-3.5 text-[#D8755B]" />
                            )}
                            <span>رفع مرفق</span>
                            <input
                              type="file"
                              accept="image/*,.pdf,.doc,.docx"
                              onChange={(e) =>
                                handleSmartUploadAttachment(
                                  e.target.files?.[0],
                                  { ticketId: ticket.id }
                                )
                              }
                              className="hidden"
                            />
                          </label>

                          <button
                            type="button"
                            disabled={sendingReplyTicketId === ticket.id}
                            onClick={() => handleSendCustomerReply(ticket)}
                            className="px-4 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                          >
                            {sendingReplyTicketId === ticket.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            <span>إرسال</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Vault Quick-Picker Modal («إرفاق وثائق مساندة من خزانتي») */}
      {vaultPickerContext !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#252321]/70 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#F7F2E9] border-2 border-[#B98A78] p-5 sm:p-6 shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-[#B98A78]/30 pb-3">
              <div>
                <div className="text-[11px] font-display font-bold text-[#D8755B]">
                  التكامل المباشر مع خزانتي
                </div>
                <h3 className="text-base font-display font-extrabold text-[#252321]">
                  اختر وثائق أو صوراً مساندة من «خزانتي»
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVaultPickerContext(null)}
                className="w-8 h-8 rounded-lg hover:bg-[#EDE6DA] flex items-center justify-center text-[#252321] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={vaultSearchQuery}
              onChange={(e) => setVaultSearchQuery(e.target.value)}
              placeholder="ابحث في وثائق خزانتك بالاسم أو المناسبة..."
              className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3.5 py-2 text-xs text-[#252321]"
            />

            {filteredVaultItems.length === 0 ? (
              <div className="rounded-xl bg-white border border-[#B98A78]/30 p-6 text-center text-xs text-[#252321]/70">
                لا توجد وثائق محفوظة حالياً في «خزانتي». يمكنك رفع مرفق جديد مباشرةً أو إضافة وثائقك في تبويب «خزانتي».
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filteredVaultItems.map((item) => {
                  const isSelected = activeVaultSelectedIds.has(item.id);
                  const thumb =
                    item.thumbnailDataUrl ||
                    (item.fileDataUrl?.startsWith('data:image') ||
                    item.fileDataUrl?.startsWith('https://')
                      ? item.fileDataUrl
                      : '');

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleVaultAttachmentSelection(item)}
                      className={`w-full rounded-xl p-3 border text-right flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#FFFDF9] border-2 border-[#D8755B]'
                          : 'bg-white border-[#B98A78]/35 hover:bg-[#FAF6F0]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={item.title}
                            className="w-11 h-11 rounded-lg object-cover border border-[#B98A78]/30 shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-[#EDE6DA] flex items-center justify-center text-[#8D4925] shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-display font-bold text-[#252321] truncate">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-[#8D4925] truncate">
                            {item.dateOrOccasion || 'أرشيف خزانتي'}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-[#D8755B] border-[#D8755B] text-white'
                            : 'bg-[#F7F2E9] border-[#B98A78]/50 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-[#B98A78]/25">
              <button
                type="button"
                onClick={() => setVaultPickerContext(null)}
                className="px-5 py-2 rounded-xl bg-[#252321] hover:bg-[#3a3633] text-white text-xs font-display font-bold cursor-pointer"
              >
                تم الاختيار ({activeVaultSelectedIds.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
