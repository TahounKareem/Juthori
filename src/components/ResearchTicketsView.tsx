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
  Paperclip,
  MapPin,
  X,
  FolderOpen,
  MessageSquare,
  AlertCircle,
  Check,
  GitMerge,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Plus,
  Archive,
} from 'lucide-react';
import { auth } from '../services/firebase';
import {
  CanonicalTicketLifecycleStage,
  FamilyVaultMediaItem,
  ResearchTicketAttachmentRef,
  ResearchTicketData,
  canonicalCustomerEmailUid,
  createResearchTicket,
  fetchUserResearchTickets,
  fetchUserVaultArchive,
  readVaultArchiveFromLocal,
} from '../services/firestoreService';
import {
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
  kashafiMode?: boolean;
  onOpenFullTicketsPage?: () => void;
  onTicketsStatusChange?: (status: {
    hasAnyTicket: boolean;
    hasResearcherReplyWaiting: boolean;
  }) => void;
}

const SLEEK_STEPPER_STEPS: Array<{
  key: string;
  label: string;
}> = [
  { key: 'received', label: 'استلام الطلب' },
  { key: 'review', label: 'الفحص المرجعي' },
  { key: 'audit', label: 'المطابقة والتدقيق' },
  { key: 'approved', label: 'اعتماد النتيجة' },
  { key: 'issued', label: 'إصدار كشّاف الربط' },
];

function getStepperActiveIndex(
  stage: CanonicalTicketLifecycleStage,
  isAdopted: boolean
): number {
  switch (stage) {
    case 'OPEN':
      return 0;
    case 'IN_REVIEW':
      return 1;
    case 'NEEDS_INFO':
      return 2;
    case 'RESOLVED':
      return isAdopted ? 4 : 3;
    case 'CLOSED':
      return 4;
  }
}

export const ResearchTicketsView: React.FC<ResearchTicketsViewProps> = ({
  result,
  accountType = AccountLegalType.Individual,
  userEmail,
  userId,
  userPhone = '',
  isVip = false,
  onRequestUpgradeVip,
  initialDraft,
  onConsumeDraft,
  onLogActivity,
  onAdoptResolvedLineage,
  embeddedHomeWidget = false,
  kashafiMode = false,
  onOpenFullTicketsPage,
  onTicketsStatusChange,
}) => {
  const isFamilyRegistrar = accountType === AccountLegalType.RecordKeeper;
  const [tickets, setTickets] = useState<ResearchTicketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adoptedBannerMessage, setAdoptedBannerMessage] = useState<
    string | null
  >(null);
  const [showArchivedTickets, setShowArchivedTickets] = useState(false);

  // Clean collapsible thread state per ticket
  const [expandedThreadByTicket, setExpandedThreadByTicket] = useState<
    Record<string, boolean>
  >({});

  // New investigation request modal state (for calm empty/archive CTA)
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [newTargetAncestor, setNewTargetAncestor] = useState('');
  const [newTribeHint, setNewTribeHint] = useState(
    result.rootTribeName || ''
  );
  const [newBranchHint, setNewBranchHint] = useState(
    result.rootBranchName || ''
  );
  const [newNotes, setNewNotes] = useState('');
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);

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

      // Auto-expand threads only where researcher awaits client reply
      const autoExpand: Record<string, boolean> = {};
      list.forEach((t) => {
        const st = resolveTicketLifecycleStage(t);
        const msgs = t.messages || [];
        const lastMsg = msgs[msgs.length - 1];
        if (
          st === 'NEEDS_INFO' ||
          Boolean(lastMsg && lastMsg.senderRole === 'researcher')
        ) {
          autoExpand[t.id] = true;
        }
      });
      setExpandedThreadByTicket((prev) => ({ ...autoExpand, ...prev }));

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
        `دمج التوثيق المعتمد من التذكرة #${ticket.ticketNumber} (${outcome.enrichedResult.rootBranchName} ← ${outcome.enrichedResult.rootTribeName})`
      );
    } finally {
      setAdoptingTicketId(null);
    }
  };

  const handleCreateNewResearchTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTarget =
      newTargetAncestor.trim() ||
      `تحقيق وتوثيق مسار نسب أسرة ${result.familyName}`;
    setIsCreatingTicket(true);
    try {
      const created = await createResearchTicket({
        userId: currentUid,
        userFullName: buildDefaultFullName(),
        userEmail,
        userPhone,
        familyName: result.familyName || 'العائلة',
        targetAncestor: cleanTarget,
        tribeName: newTribeHint.trim() || result.rootTribeName || '',
        familyBranch: newBranchHint.trim() || result.rootBranchName || '',
        originCountry: result.originCountry || 'السعودية',
        originRegion: result.originRegion || '',
        verificationChoiceLabel: 'طلب تحقيق واستكشاف نسبي عبر كشّافي',
        additionalNotes: newNotes.trim(),
        priorityTag: isFamilyRegistrar ? 'PRIORITY_REGISTRAR' : undefined,
        lifecycleStage: 'OPEN',
      });

      setTickets((prev) => [created, ...prev]);
      setShowNewTicketModal(false);
      setNewTargetAncestor('');
      setNewNotes('');
      onTicketsStatusChange?.({
        hasAnyTicket: true,
        hasResearcherReplyWaiting: false,
      });
      onLogActivity?.(
        'فتح بعثة تحقيق نسبي جديدة',
        `تم فتح التذكرة #${created.ticketNumber} عبر كشّافي وإحالتها إلى مرصد البحوث`
      );
    } finally {
      setIsCreatingTicket(false);
    }
  };

  const getStageLabelAr = (stage: CanonicalTicketLifecycleStage): string => {
    switch (stage) {
      case 'OPEN':
        return 'تم استلام الطلب';
      case 'IN_REVIEW':
        return 'قيد الفحص المرجعي';
      case 'NEEDS_INFO':
        return 'بانتظار توضيح من العميل';
      case 'RESOLVED':
        return 'تم اعتماد النتيجة المرجعية';
      case 'CLOSED':
        return 'مكتملة ومؤرشفة';
    }
  };

  const getStageToneClasses = (stage: CanonicalTicketLifecycleStage): string => {
    switch (stage) {
      case 'OPEN':
        return 'bg-[#F5F1E8] text-[#1F1F1C] border-[#D8C7B2]/80';
      case 'IN_REVIEW':
        return 'bg-[#F5F1E8] text-[#1F1F1C] border-[#D8C7B2]/80';
      case 'NEEDS_INFO':
        return 'bg-[#F5F1E8] text-[#1F1F1C] border-[#D8C7B2]';
      case 'RESOLVED':
        return 'bg-[#F5F1E8] text-[#1F1F1C] border-[#D8C7B2]';
      case 'CLOSED':
        return 'bg-[#E8DED2] text-[#1F1F1C]/70 border-[#D8C7B2]';
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

  const activeOngoingTickets = tickets.filter((t) => {
    const st = resolveTicketLifecycleStage(t);
    if (st === 'CLOSED') return false;
    if (st === 'RESOLVED' && t.resolutionPayload?.appliedByCustomerAt) {
      return false;
    }
    return true;
  });

  const archivedTickets = tickets.filter((t) => {
    const st = resolveTicketLifecycleStage(t);
    return (
      st === 'CLOSED' ||
      (st === 'RESOLVED' && Boolean(t.resolutionPayload?.appliedByCustomerAt))
    );
  });

  const displayedTickets = embeddedHomeWidget
    ? activeOngoingTickets
    : kashafiMode
    ? showArchivedTickets
      ? tickets
      : activeOngoingTickets
    : tickets;

  if (embeddedHomeWidget && (isLoading || displayedTickets.length === 0)) {
    return null;
  }

  return (
    <div
      data-testid={
        kashafiMode
          ? 'kashafi-research-mission-section'
          : embeddedHomeWidget
          ? 'home-active-research-ticket-box'
          : 'full-research-tickets-view'
      }
      className="space-y-4 text-[#1F1F1C]"
    >
      {adoptedBannerMessage && (
        <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757] p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#D97757] text-[#D97757] flex items-center justify-center shrink-0">
              <GitMerge className="w-4 h-4" />
            </div>
            <div className="text-xs sm:text-sm font-display font-bold text-[#1F1F1C]">
              {adoptedBannerMessage}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAdoptedBannerMessage(null)}
            className="p-1.5 rounded-lg hover:bg-[#E8DED2] text-[#1F1F1C] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Standalone Page Header (Only when NOT inside kashafiMode or embeddedHomeWidget) */}
      {!kashafiMode && !embeddedHomeWidget && (
        <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-display font-bold text-[#1F1F1C]">
              بعثة التحقيق والربط المرجعي — مرصد البحوث
            </h2>
            <p className="text-xs sm:text-sm text-[#1F1F1C]/70 max-w-2xl leading-relaxed">
              متابعة مراحل التحقيق الأرشيفي لعمود نسب عائلتكم، والرد المباشر على الباحث المختص أو إرفاق وثائق مساندة من «خزانتي».
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadTickets}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] text-[#D97757] border border-[#D8C7B2] text-xs font-display font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              />
              <span>تحديث</span>
            </button>
            <button
              type="button"
              onClick={() => setShowNewTicketModal(true)}
              className="px-4 py-2 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>طلب تحقيق جديد</span>
            </button>
          </div>
        </div>
      )}

      {/* Kashafi Mode Compact Section Toolbar */}
      {kashafiMode && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] flex items-center justify-center text-[#D97757] shrink-0">
              <Scroll className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-display font-bold text-[#1F1F1C]">
                بعثة التحقيق والربط المرجعي الجارية
              </h2>
              <p className="text-xs text-[#1F1F1C]/70">
                متابعة فورية لمراحل الفحص الأرشيفي والمراسلات مع الباحث المختص
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {archivedTickets.length > 0 && (
              <button
                type="button"
                onClick={() => setShowArchivedTickets((v) => !v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold border transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                  showArchivedTickets
                    ? 'bg-[#D97757] text-[#F5F1E8] border-[#D97757]'
                    : 'bg-[#F5F1E8] text-[#1F1F1C]/70 border-[#D8C7B2] hover:bg-[#F5F1E8]'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>
                  {showArchivedTickets
                    ? 'عرض الجارية فقط'
                    : `الأرشيف المكتمل (${archivedTickets.length})`}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={loadTickets}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] text-[#D97757] border border-[#D8C7B2] text-xs font-display font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              />
              <span>تحديث</span>
            </button>
            {activeOngoingTickets.length === 0 && (
              <button
                type="button"
                onClick={() => setShowNewTicketModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>طلب تحقيق أو استكشاف نسبي جديد</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      {isLoading ? (
        <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#D97757] mb-2" />
          <p className="text-xs text-[#1F1F1C]/70">
            جاري تحميل حالة بعثة التحقيق والمراسلات...
          </p>
        </div>
      ) : displayedTickets.length === 0 ? (
        <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] flex items-center justify-center text-[#D97757] shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-bold text-sm sm:text-base text-[#1F1F1C]">
                لا توجد بعثة تحقيق جارية في مرصد البحوث حالياً
              </h3>
              <p className="text-xs text-[#1F1F1C]/70 leading-relaxed max-w-xl">
                {archivedTickets.length > 0
                  ? `لديك ${archivedTickets.length} تذكرة مكتملة في الأرشيف المرجعي. يمكنك استعراضها أو فتح طلب تحقيق واستكشاف نسبي جديد في أي وقت.`
                  : 'يمكنك فتح طلب تحقيق أو استكشاف نسبي جديد لتوجيه فريق الباحثين لفحص عمود نسب عائلتكم في أمهات الكتب والمخطوطات.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {archivedTickets.length > 0 && !showArchivedTickets && (
              <button
                type="button"
                onClick={() => setShowArchivedTickets(true)}
                className="px-3.5 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs font-display font-bold text-[#D97757] cursor-pointer whitespace-nowrap shrink-0"
              >
                استعراض الأرشيف ({archivedTickets.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowNewTicketModal(true)}
              className="px-4 py-2 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>طلب تحقيق أو استكشاف نسبي جديد</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedTickets.map((ticket) => {
            const stage = resolveTicketLifecycleStage(ticket);
            const isAlreadyAdopted = Boolean(
              ticket.resolutionPayload?.appliedByCustomerAt
            );
            const activeStepIdx = getStepperActiveIndex(
              stage,
              isAlreadyAdopted
            );
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
            const messagesCount = ticket.messages?.length || 0;
            const lastMessage =
              messagesCount > 0
                ? ticket.messages![messagesCount - 1]
                : undefined;
            const isThreadExpanded = Boolean(expandedThreadByTicket[ticket.id]);

            const geoScopeLabel = [
              ticket.originCountry || result.originCountry || 'السعودية',
              ticket.originRegion || result.originRegion,
            ]
              .filter(Boolean)
              .join(' — ');
            const tribeBranchLabel = [ticket.tribeName, ticket.familyBranch]
              .filter(Boolean)
              .join(' / ');
            const researcherLabel =
              ticket.assignedResearcherName || 'مرصد البحوث (قيد الإسناد)';
            const openedDateLabel = ticket.openedAt
              ? new Date(ticket.openedAt).toLocaleDateString('ar-SA', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : '—';

            return (
              <div
                key={ticket.id}
                data-testid={`research-ticket-card-${ticket.id}`}
                className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-5 sm:p-6 space-y-5"
              >
                {/* 1. Unified Sleek Top Header & Inline Metadata Strip */}
                <div className="space-y-2.5 pb-4 border-b border-[#D8C7B2]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                      <h3 className="font-display font-bold text-base sm:text-lg text-[#1F1F1C]">
                        {ticket.targetAncestor || `تحقيق نسب أسرة ${ticket.familyName}`}
                      </h3>
                      <span
                        dir="ltr"
                        className="font-mono tabular-nums text-xs font-bold text-[#D97757] bg-[#F5F1E8] border border-[#D8C7B2] px-2 py-0.5 rounded-md"
                      >
                        #{ticket.ticketNumber}
                      </span>
                      {(ticket.priorityTag === 'PRIORITY_REGISTRAR' ||
                        isFamilyRegistrar) && (
                        <span
                          data-testid="priority-registrar-badge"
                          className="text-[11px] font-display font-bold text-[#D97757] inline-flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-[#D97757]" />
                          <span>أولوية أمين السجل</span>
                        </span>
                      )}
                    </div>

                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-display font-bold border inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${getStageToneClasses(
                        stage
                      )}`}
                    >
                      {stage === 'RESOLVED' || stage === 'CLOSED' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : stage === 'NEEDS_INFO' ? (
                        <AlertCircle className="w-3.5 h-3.5" />
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                      <span>{getStageLabelAr(stage)}</span>
                    </span>
                  </div>

                  {/* Clean Unboxed Inline Metadata Row (Replacing Cluttered Gray Box) */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#1F1F1C]/70">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#D97757]" />
                      <span className="text-[#1F1F1C]/70">النطاق الجغرافي:</span>
                      <strong className="text-[#1F1F1C] font-semibold">
                        {geoScopeLabel}
                      </strong>
                    </span>
                    <span className="text-[#D8C7B2]" aria-hidden="true">
                      ·
                    </span>
                    <span>
                      <span className="text-[#1F1F1C]/70">القبيلة/الفرع:</span>{' '}
                      <strong className="text-[#1F1F1C] font-semibold">
                        {tribeBranchLabel || 'قيد الفحص المرجعي'}
                      </strong>
                    </span>
                    <span className="text-[#D8C7B2]" aria-hidden="true">
                      ·
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-[#D97757]" />
                      <span className="text-[#1F1F1C]/70">جهة التحقيق:</span>
                      <strong className="text-[#D97757] font-semibold">
                        {researcherLabel}
                      </strong>
                    </span>
                    <span className="text-[#D8C7B2]" aria-hidden="true">
                      ·
                    </span>
                    <span className="tabular-nums">
                      <span className="text-[#1F1F1C]/70">تاريخ الطلب:</span>{' '}
                      <strong className="text-[#1F1F1C] font-semibold">
                        {openedDateLabel}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* 2. Sleek Horizontal Connected 5-Step Stepper */}
                <div className="pt-1 pb-1 overflow-x-auto no-scrollbar">
                  <div className="min-w-[560px] flex items-center justify-between relative px-2">
                    {SLEEK_STEPPER_STEPS.map((step, idx) => {
                      const isCompleted =
                        idx < activeStepIdx ||
                        stage === 'CLOSED' ||
                        (stage === 'RESOLVED' && isAlreadyAdopted);
                      const isCurrent =
                        idx === activeStepIdx &&
                        !(stage === 'CLOSED' || (stage === 'RESOLVED' && isAlreadyAdopted));
                      const isNeedsInfoAlert =
                        isCurrent && stage === 'NEEDS_INFO';

                      return (
                        <React.Fragment key={step.key}>
                          <div className="flex flex-col items-center gap-1.5 relative z-10 shrink-0">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-colors border ${
                                isCompleted
                                  ? 'bg-[#D97757] border-[#D97757] text-[#F5F1E8]'
                                  : isNeedsInfoAlert
                                  ? 'bg-[#D97757] border-[#D97757] text-[#F5F1E8]'
                                  : isCurrent
                                  ? 'bg-[#D97757] border-[#D97757] text-[#F5F1E8] ring-4 ring-[#D97757]/15'
                                  : 'bg-[#F5F1E8] border-[#D8C7B2] text-[#1F1F1C]/70'
                              }`}
                            >
                              {isCompleted ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <span className="tabular-nums">{idx + 1}</span>
                              )}
                            </div>
                            <span
                              className={`text-[11px] font-display whitespace-nowrap ${
                                isCurrent
                                  ? 'font-bold text-[#1F1F1C]'
                                  : isCompleted
                                  ? 'font-semibold text-[#D97757]'
                                  : 'font-medium text-[#1F1F1C]/70'
                              }`}
                            >
                              {step.label}
                            </span>
                          </div>

                          {idx < SLEEK_STEPPER_STEPS.length - 1 && (
                            <div className="flex-1 h-0.5 mx-2 -mt-5 rounded-full bg-[#E8DED2] overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  idx < activeStepIdx
                                    ? 'w-full bg-[#D97757]'
                                    : idx === activeStepIdx && isCurrent
                                    ? 'w-1/2 bg-[#D97757]'
                                    : 'w-0'
                                }`}
                              />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* NEEDS_INFO Action Callout */}
                {stage === 'NEEDS_INFO' && (
                  <div className="rounded-xl bg-[#F5F1E8]/90 border border-[#D8C7B2] p-3.5 flex items-start gap-2.5 text-xs text-[#1F1F1C]">
                    <AlertCircle className="w-4 h-4 text-[#D97757] shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-display block mb-0.5">
                        بانتظار استكمال توضيح أو وثيقة مساندة من قِبلكم
                      </strong>
                      <span>
                        يرجى الرد في سجل المراسلات أدناه أو إرفاق وثيقة من «خزانتي» ليستأنف الباحث الفحص المرجعي فوراً.
                      </span>
                    </div>
                  </div>
                )}

                {/* Attached Supporting Docs (Compact Strip) */}
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="text-[#1F1F1C]/70 font-semibold inline-flex items-center gap-1">
                      <Paperclip className="w-3.5 h-3.5 text-[#D97757]" />
                      <span>المرفقات ({ticket.attachments.length}):</span>
                    </span>
                    {ticket.attachments.map((att) => (
                      <span
                        key={att.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] px-2.5 py-1 text-[11px] font-semibold text-[#1F1F1C]"
                      >
                        <FileText className="w-3 h-3 text-[#D97757]" />
                        <span className="truncate max-w-[170px]">{att.title}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* RESOLVED Decision & 1-Click Adoption into Spine & Tree */}
                {hasResolutionToAdopt && (
                  <div className="rounded-xl border border-[#D8C7B2]/80 bg-[#F5F1E8]/50 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[#1F1F1C] font-display font-bold text-sm">
                        <ShieldCheck className="w-4 h-4 text-[#D97757]" />
                        <span>
                          {ticket.resolutionPayload?.decisionTitle ||
                            'قرار التوثيق المرجعي المعتمد من مرصد البحوث'}
                        </span>
                      </div>
                      {isAlreadyAdopted && (
                        <span className="text-[11px] font-display font-bold text-[#1F1F1C]">
                          تم الاعتماد والدمج في حسابك ✓
                        </span>
                      )}
                    </div>

                    {(ticket.resolutionPayload?.summaryNotes ||
                      ticket.researchFindings) && (
                      <p className="text-xs text-[#1F1F1C]/90 leading-relaxed">
                        {ticket.resolutionPayload?.summaryNotes ||
                          ticket.researchFindings}
                      </p>
                    )}

                    {(ticket.resolutionPayload?.verifiedRootBranch ||
                      ticket.resolutionPayload?.verifiedRootTribe ||
                      ticket.resolutionPayload?.certifiedAncestorName) && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#D97757] bg-[#F5F1E8] px-3 py-2 rounded-lg border border-[#D8C7B2]">
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
                      <div className="text-[11px] text-[#1F1F1C]/90">
                        <strong>المصادر والوثائق المعتمدة:</strong>{' '}
                        {ticket.resolutionPayload?.verifiedCitation ||
                          ticket.verifiedSources}
                      </div>
                    )}

                    <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[11px] text-[#1F1F1C]/70">
                        يعكس الاعتماد هذا التوثيق فوراً في «عمود نسبي» وجسر «شجرتي».
                      </span>
                      <button
                        type="button"
                        data-testid={`adopt-ticket-resolution-btn-${ticket.id}`}
                        disabled={adoptingTicketId === ticket.id}
                        onClick={() => handleAdoptResolution(ticket)}
                        className="px-4 py-2 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
                      >
                        {adoptingTicketId === ticket.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <GitMerge className="w-3.5 h-3.5 text-[#D97757]" />
                        )}
                        <span>
                          {isAlreadyAdopted
                            ? 'تحديث ومزامنة الدمج ✓'
                            : 'اعتماد ودمج النتيجة في عمود نسبي'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Clean Collapsible Correspondence Thread */}
                <div className="rounded-xl bg-[#F5F1E8]/80 border border-[#D8C7B2] overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedThreadByTicket((prev) => ({
                        ...prev,
                        [ticket.id]: !prev[ticket.id],
                      }))
                    }
                    className="w-full px-4 py-3 flex items-center justify-between gap-3 text-right hover:bg-[#E8DED2]/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MessageSquare className="w-4 h-4 text-[#D97757] shrink-0" />
                      <span className="text-xs font-display font-bold text-[#1F1F1C] whitespace-nowrap">
                        سجل المراسلات والتوضيحات مع الباحث ({messagesCount})
                      </span>
                      {!isThreadExpanded && lastMessage && (
                        <span className="hidden sm:inline text-[11px] text-[#1F1F1C]/70 truncate max-w-md">
                          — {lastMessage.senderName}: {lastMessage.body}
                        </span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-display font-bold text-[#D97757] whitespace-nowrap shrink-0">
                      <span>{isThreadExpanded ? 'طي السجل' : 'فتح المحادثة والرد'}</span>
                      {isThreadExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </span>
                  </button>

                  {isThreadExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-[#D8C7B2] space-y-3 bg-[#F5F1E8]">
                      {ticket.messages && ticket.messages.length > 0 ? (
                        <div className="space-y-2.5 max-h-72 overflow-y-auto pl-1">
                          {ticket.messages.map((msg) => {
                            const isResearcher = msg.senderRole === 'researcher';
                            return (
                              <div
                                key={msg.id}
                                className={`rounded-xl p-3 text-xs border ${
                                  isResearcher
                                    ? 'bg-[#F5F1E8] border-[#D97757]/60'
                                    : 'bg-[#F5F1E8] border-[#D8C7B2]'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <div className="flex items-center gap-2 text-xs">
                                    <strong className="font-display text-[#1F1F1C]">
                                      {msg.senderName}
                                    </strong>
                                    <span className="text-[11px] text-[#D97757] font-semibold">
                                      · {isResearcher ? 'باحث المرصد' : 'صاحب الطلب'}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-[#1F1F1C]/70 tabular-nums">
                                    {new Date(msg.createdAt).toLocaleString('ar-SA', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                <p className="text-[#1F1F1C]/85 leading-relaxed">
                                  {msg.body}
                                </p>
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-[#D8C7B2]">
                                    {msg.attachments.map((att) => (
                                      <span
                                        key={att.id}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D97757]"
                                      >
                                        <Paperclip className="w-3 h-3 text-[#D97757]" />
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
                        <p className="text-xs text-[#1F1F1C]/70 py-1">
                          {ticket.additionalNotes ||
                            'لا توجد مراسلات سابقة بعد. يمكنك إضافة أي توضيح أو إرفاق وثيقة مساندة للباحث أدناه.'}
                        </p>
                      )}

                      {canReplyInThread && (
                        <div className="pt-2.5 border-t border-[#D8C7B2] space-y-2.5">
                          {pendingReplyAttachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {pendingReplyAttachments.map((att) => (
                                <span
                                  key={att.id}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F5F1E8] border border-[#D97757]/45 text-[11px] font-semibold text-[#1F1F1C]"
                                >
                                  <span>{att.title}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReplyAttachmentsByTicket((prev) => ({
                                        ...prev,
                                        [ticket.id]: (
                                          prev[ticket.id] || []
                                        ).filter((x) => x.id !== att.id),
                                      }))
                                    }
                                    className="text-[#D97757] hover:text-[#D97757] cursor-pointer"
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
                              placeholder="اكتب توضيحك أو ردك للباحث المختص..."
                              className="flex-1 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2 text-xs text-[#1F1F1C] focus:bg-[#F5F1E8] focus:outline-none focus:border-[#D97757]"
                            />

                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setVaultPickerContext({ ticketId: ticket.id })
                                }
                                className="px-3 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[11px] font-display font-bold text-[#D97757] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <FolderOpen className="w-3.5 h-3.5 text-[#D97757]" />
                                <span>من خزانتي</span>
                              </button>

                              <label className="px-3 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[11px] font-display font-bold text-[#1F1F1C] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0">
                                {uploadingReplyTicketId === ticket.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D97757]" />
                                ) : (
                                  <Paperclip className="w-3.5 h-3.5 text-[#D97757]" />
                                )}
                                <span>إرفاق وثيقة</span>
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
                                className="px-4 py-2 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
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
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Research Ticket Modal */}
      {showNewTicketModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1F1F1C]/65 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#F5F1E8] border border-[#D97757] p-6 shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-[#D8C7B2] pb-3">
              <div>
                <h3 className="text-base font-display font-bold text-[#1F1F1C]">
                  فتح طلب تحقيق أو استكشاف نسبي جديد
                </h3>
                <p className="text-xs text-[#1F1F1C]/70 mt-0.5">
                  يُحال الطلب مباشرة إلى مرصد البحوث لمتابعته وتوثيق نتائجه في كشّافي
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewTicketModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-[#F5F1E8] flex items-center justify-center text-[#1F1F1C] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewResearchTicket} className="space-y-3.5">
              <div>
                <label className="block text-xs font-display font-bold text-[#1F1F1C] mb-1">
                  موضوع التحقيق أو الجد المستهدف
                </label>
                <input
                  type="text"
                  required
                  value={newTargetAncestor}
                  onChange={(e) => setNewTargetAncestor(e.target.value)}
                  placeholder={`مثال: تحقيق اتصال أسرة ${result.familyName} بالجد الجامع`}
                  className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2.5 text-xs text-[#1F1F1C] focus:bg-[#F5F1E8] focus:outline-none focus:border-[#D97757]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-display font-bold text-[#1F1F1C] mb-1">
                    القبيلة / الجذر المتوقع (اختياري)
                  </label>
                  <input
                    type="text"
                    value={newTribeHint}
                    onChange={(e) => setNewTribeHint(e.target.value)}
                    placeholder="مثال: تميم / عتيبة / قحطان"
                    className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2 text-xs text-[#1F1F1C] focus:bg-[#F5F1E8] focus:outline-none focus:border-[#D97757]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-display font-bold text-[#1F1F1C] mb-1">
                    الفخذ أو الفرع (اختياري)
                  </label>
                  <input
                    type="text"
                    value={newBranchHint}
                    onChange={(e) => setNewBranchHint(e.target.value)}
                    placeholder="اسم الفخذ أو البطن المعروف"
                    className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2 text-xs text-[#1F1F1C] focus:bg-[#F5F1E8] focus:outline-none focus:border-[#D97757]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-display font-bold text-[#1F1F1C] mb-1">
                  توضيحات أو روايات عائلية مساندة
                </label>
                <textarea
                  rows={3}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="اذكر أسماء الأجداد المعروفين أو المناطق التاريخية أو الوثائق المتوفرة في خزانتك..."
                  className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2.5 text-xs text-[#1F1F1C] focus:bg-[#F5F1E8] focus:outline-none focus:border-[#D97757]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8C7B2]">
                <button
                  type="button"
                  onClick={() => setShowNewTicketModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs font-display font-bold text-[#1F1F1C]/70 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTicket}
                  className="px-5 py-2 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isCreatingTicket ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>إرسال الطلب إلى مرصد البحوث</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vault Quick-Picker Modal */}
      {vaultPickerContext !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1F1F1C]/70 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#F5F1E8] border border-[#D97757] p-5 sm:p-6 shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-[#D8C7B2] pb-3">
              <div>
                <h3 className="text-base font-display font-bold text-[#1F1F1C]">
                  إرفاق وثائق مساندة من «خزانتي»
                </h3>
                <p className="text-xs text-[#1F1F1C]/70">
                  اختر من الوثائق والصور المحفوظة في خزانة عائلتك
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVaultPickerContext(null)}
                className="w-8 h-8 rounded-lg hover:bg-[#F5F1E8] flex items-center justify-center text-[#1F1F1C] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={vaultSearchQuery}
              onChange={(e) => setVaultSearchQuery(e.target.value)}
              placeholder="ابحث في وثائق خزانتك بالاسم أو المناسبة..."
              className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2 text-xs text-[#1F1F1C] focus:bg-[#F5F1E8] focus:outline-none focus:border-[#D97757]"
            />

            {filteredVaultItems.length === 0 ? (
              <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] p-6 text-center text-xs text-[#1F1F1C]/70">
                لا توجد وثائق محفوظة حالياً في «خزانتي». يمكنك إرفاق ملف مباشر من جهازك.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pl-1">
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
                          ? 'bg-[#F5F1E8] border-[#D97757]'
                          : 'bg-[#F5F1E8] border-[#D8C7B2] hover:bg-[#F5F1E8]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={item.title}
                            className="w-10 h-10 rounded-lg object-cover border border-[#D8C7B2] shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-[#E8DED2] flex items-center justify-center text-[#D97757] shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-display font-bold text-[#1F1F1C] truncate">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-[#D97757] truncate">
                            {item.dateOrOccasion || 'أرشيف خزانتي'}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-[#D97757] border-[#D97757] text-[#F5F1E8]'
                            : 'bg-[#F5F1E8] border-[#D8C7B2] text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-[#D8C7B2]">
              <button
                type="button"
                onClick={() => setVaultPickerContext(null)}
                className="px-5 py-2 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold cursor-pointer"
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
