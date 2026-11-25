import React, { useEffect, useMemo, useState } from 'react';
import {
  Compass,
  CheckCircle2,
  ExternalLink,
  Loader2,
  BookOpen,
  Wallet,
  X,
  ArrowLeft,
  Clock,
  Check,
  Sparkles,
  FileCheck2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  UnifiedWorkspaceHeader,
  WORKSPACE_PRIMARY_BTN_CLASS,
  WORKSPACE_SECONDARY_BTN_CLASS,
} from './UnifiedWorkspaceHeader';
import { JUTHORI_SERVICE_ICONS } from '../config/serviceIcons';
import {
  AccountLegalType,
  DashboardAccessCapabilities,
  DashboardTab,
  LineageSearchResult,
} from '../types/juthori';
import {
  canonicalCustomerEmailUid,
  executeAtomicWalletOperation,
  fetchUserFamilyTreeFromFirebase,
  fetchUserVaultArchive,
  readUserFamilyTreeFromLocal,
  readVaultArchiveFromLocal,
} from '../services/firestoreService';
import {
  KashafiCampaignRecord,
  KashafiItemRecord,
  KashafiServiceOrderRecord,
  createKashafiServiceOrder,
  doesCampaignMatchClient,
  fetchActiveKashafiCampaignsForClient,
  fetchCustomerKashafiItems,
  fetchCustomerKashafiOrders,
  getKashafiCategoryLabelAr,
  getKashafiOrderStatusLabelAr,
  markKashafiItemRead,
} from '../services/kashafiService';
import { ResearchTicketsView } from './ResearchTicketsView';
import { auth } from '../services/firebase';

interface KashafiHubViewProps {
  result: LineageSearchResult;
  accountType: AccountLegalType;
  caps: DashboardAccessCapabilities;
  walletBalance: number;
  userId?: string;
  userEmail: string;
  userPhone?: string;
  onNavigateTab: (tab: DashboardTab) => void;
  onOpenWalletDrawer: () => void;
  onUpgradeAnnualVip: () => void;
  onWalletBalanceUpdated?: (nextBalance: number) => void;
  onLogActivity: (action: string, detail: string) => void;
  onAdoptResolvedLineage?: (enrichedResult: LineageSearchResult) => void;
  onTicketsStatusChange?: (status: {
    hasAnyTicket: boolean;
    hasResearcherReplyWaiting: boolean;
  }) => void;
  onKashafiUnreadCountChange?: (count: number) => void;
}

export const KashafiHubView: React.FC<KashafiHubViewProps> = ({
  result,
  accountType,
  caps,
  walletBalance,
  userId,
  userEmail,
  userPhone = '',
  onNavigateTab,
  onOpenWalletDrawer,
  onUpgradeAnnualVip,
  onWalletBalanceUpdated,
  onLogActivity,
  onAdoptResolvedLineage,
  onTicketsStatusChange,
  onKashafiUnreadCountChange,
}) => {
  const resolvedUid =
    userId ||
    auth.currentUser?.uid ||
    canonicalCustomerEmailUid(userEmail) ||
    `usr_${userEmail.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  const [kashafiItems, setKashafiItems] = useState<KashafiItemRecord[]>([]);
  const [campaigns, setCampaigns] = useState<KashafiCampaignRecord[]>([]);
  const [orders, setOrders] = useState<KashafiServiceOrderRecord[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [hasActiveResearchTicket, setHasActiveResearchTicket] = useState(false);

  const [vaultCount, setVaultCount] = useState<number>(() => {
    const local = readVaultArchiveFromLocal(
      resolvedUid,
      result.familyName,
      userEmail
    );
    return local?.items?.length || 0;
  });

  const [treeCount, setTreeCount] = useState<number>(() => {
    const local = readUserFamilyTreeFromLocal(
      resolvedUid,
      result.familyName,
      userEmail
    );
    return Array.isArray(local) ? local.length : 0;
  });

  // Service Order Modal state
  const [selectedCampaignForOrder, setSelectedCampaignForOrder] =
    useState<KashafiCampaignRecord | null>(null);
  const [orderCustomerNotes, setOrderCustomerNotes] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccessToast, setOrderSuccessToast] = useState<string | null>(
    null
  );

  // Expanded discovery item details
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const loadKashafiData = async () => {
    setIsLoadingData(true);
    try {
      const [itemsRes, campaignsRes, ordersRes, vaultRes, treeRes] =
        await Promise.allSettled([
          fetchCustomerKashafiItems(resolvedUid, userEmail),
          fetchActiveKashafiCampaignsForClient(),
          fetchCustomerKashafiOrders(resolvedUid, userEmail),
          fetchUserVaultArchive(resolvedUid, result.familyName, userEmail),
          fetchUserFamilyTreeFromFirebase(
            resolvedUid,
            result.familyName,
            userEmail
          ),
        ]);

      const realItems =
        itemsRes.status === 'fulfilled' ? itemsRes.value : [];
      const realCampaigns =
        campaignsRes.status === 'fulfilled' ? campaignsRes.value : [];
      const realOrders =
        ordersRes.status === 'fulfilled' ? ordersRes.value : [];

      setKashafiItems(realItems);
      setCampaigns(realCampaigns);
      setOrders(realOrders);

      if (vaultRes.status === 'fulfilled' && vaultRes.value?.items) {
        setVaultCount(vaultRes.value.items.length);
      }
      if (treeRes.status === 'fulfilled' && Array.isArray(treeRes.value)) {
        setTreeCount(treeRes.value.length);
      }

      const unreadItemsCount = realItems.filter((i) => !i.isRead).length;
      onKashafiUnreadCountChange?.(unreadItemsCount);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadKashafiData();
  }, [resolvedUid, userEmail, result.familyName]);

  // Filter strictly to active campaigns matching this client's REAL profile & assets
  const eligibleCampaigns = useMemo(
    () =>
      campaigns.filter((cmp) =>
        doesCampaignMatchClient(cmp, {
          familyName: result.familyName,
          isVip: caps.isVip,
          vaultItemsCount: vaultCount,
          treeMembersCount: treeCount,
        })
      ),
    [campaigns, result.familyName, caps.isVip, vaultCount, treeCount]
  );

  const ordersByCampaignId = useMemo(() => {
    const map = new Map<string, KashafiServiceOrderRecord>();
    for (const ord of orders) {
      if (!map.has(ord.campaignId)) {
        map.set(ord.campaignId, ord);
      }
    }
    return map;
  }, [orders]);

  const handleMarkItemRead = async (item: KashafiItemRecord) => {
    if (item.isRead) return;
    setKashafiItems((prev) => {
      const next = prev.map((x) =>
        x.id === item.id
          ? { ...x, isRead: true, readAt: new Date().toISOString() }
          : x
      );
      onKashafiUnreadCountChange?.(next.filter((i) => !i.isRead).length);
      return next;
    });
    await markKashafiItemRead(item.id);
  };

  const handleCampaignCtaClick = (campaign: KashafiCampaignRecord) => {
    if (campaign.executionMode === 'instant_tech') {
      if (campaign.targetTab === 'wallet') {
        onOpenWalletDrawer();
      } else if (campaign.targetTab) {
        onNavigateTab(campaign.targetTab as DashboardTab);
      } else {
        onNavigateTab(DashboardTab.Lineage);
      }
      return;
    }

    // Research execution service -> open confirmation modal
    setOrderError(null);
    setOrderCustomerNotes('');
    setSelectedCampaignForOrder(campaign);
  };

  const handleConfirmResearchServiceOrder = async () => {
    if (!selectedCampaignForOrder || isSubmittingOrder) return;
    const cmp = selectedCampaignForOrder;
    const isCoveredByVip = cmp.freeForPremium && caps.isVip;
    const effectivePrice = isCoveredByVip ? 0 : Math.max(0, cmp.priceUsd);

    setOrderError(null);
    setIsSubmittingOrder(true);

    try {
      let walletTxId: string | undefined;

      if (effectivePrice > 0) {
        if (walletBalance < effectivePrice) {
          setOrderError(
            `رصيد محفظتك الحالي ($${walletBalance.toFixed(
              2
            )}) غير كافٍ لتغطية رسوم الخدمة ($${effectivePrice}). يرجى شحن المحفظة أولاً.`
          );
          setIsSubmittingOrder(false);
          return;
        }

        const fullName =
          [
            result.clientName,
            result.fatherName,
            result.grandfatherName,
            result.familyName,
          ]
            .filter((s) => s && s !== '—')
            .join(' ') || result.familyName;

        const atomicRes = await executeAtomicWalletOperation({
          userId: resolvedUid,
          userEmail,
          userFullName: fullName,
          operationType: 'UNLOCK_CAPSULE',
          amountUsd: effectivePrice,
          paymentMethod: 'wallet',
          descriptionAr: `طلب خدمة كشّافي: ${cmp.title}`,
          referenceId: cmp.id,
          skipFeatureIdempotency: true,
        });

        if (atomicRes.status === 'INSUFFICIENT_FUNDS') {
          setOrderError(
            `رصيد محفظتك الحالي ($${atomicRes.balanceBefore.toFixed(
              2
            )}) غير كافٍ لتغطية رسوم الخدمة ($${effectivePrice}).`
          );
          onWalletBalanceUpdated?.(atomicRes.balanceBefore);
          setIsSubmittingOrder(false);
          return;
        }

        walletTxId = atomicRes.transactionId;
        onWalletBalanceUpdated?.(atomicRes.balanceAfter);
      }

      const fullName =
        [
          result.clientName,
          result.fatherName,
          result.grandfatherName,
          result.familyName,
        ]
          .filter((s) => s && s !== '—')
          .join(' ') || result.familyName;

      const createdOrder = await createKashafiServiceOrder({
        campaign: cmp,
        userId: resolvedUid,
        userEmail,
        userFullName: fullName,
        familyName: result.familyName || 'العائلة',
        originCountry: result.originCountry,
        originRegion: result.originRegion,
        pricePaidUsd: effectivePrice,
        includedInPremium: isCoveredByVip,
        walletTransactionId: walletTxId,
        customerNotes: orderCustomerNotes,
      });

      setOrders((prev) => [createdOrder, ...prev]);
      setSelectedCampaignForOrder(null);
      setOrderCustomerNotes('');
      setOrderSuccessToast(
        `تم تسجيل طلبك #${createdOrder.orderNumber} وإسناده تلقائياً إلى مدير البحوث — ستصلك النتيجة فور اعتمادها في رادار الاكتشافات أعلاه ✓`
      );
      onLogActivity(
        'طلب خدمة كشّافي بحثية',
        `طلب «${cmp.title}» (#${createdOrder.orderNumber}) — إسناد تلقائي لمدير البحوث`
      );
    } catch {
      setOrderError(
        'تعذّر إرسال الطلب حالياً. يرجى المحاولة مرة أخرى بعد قليل.'
      );
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const getItemTypeLabelAr = (type: KashafiItemRecord['type']): string => {
    switch (type) {
      case 'lineage_discovery':
        return 'كشّاف وبشارة نسبية معتمدة';
      case 'service_deliverable':
        return 'تقرير ونتيجة خدمة كشّافي';
      case 'researcher_note':
        return 'ملاحظة علمية من مرصد البحوث';
      case 'ticket_update':
        return 'تحديث بعثة التحقيق';
    }
  };

  const unreadItemsCount = kashafiItems.filter((i) => !i.isRead).length;
  const activeOrdersCount = orders.filter(
    (ord) => ord.status !== 'COMPLETED' && ord.status !== 'CANCELLED'
  ).length;
  const activeMissionsCount =
    activeOrdersCount + (hasActiveResearchTicket ? 1 : 0);

  return (
    <div
      data-testid="kashafi-hub-view"
      className="w-full space-y-3.5 text-[#1F1F1C]"
    >
      {/* Unified Workspace Header (Obsidian Gilded Icon Variant + 1-Line Meta Strip) */}
      <UnifiedWorkspaceHeader
        testId="kashafi-unified-header"
        icon={<JUTHORI_SERVICE_ICONS.kashafi className="w-5 h-5" />}
        title={`كشّافي — مرصد عائلة ${result.familyName}`}
        metaItems={[
          'متابعة البعثات البحثية والرادار العلمي',
          <span key="missions" className="tabular-nums">
            البعثات الجارية:{' '}
            <strong className="font-semibold text-[#1F1F1C]">
              {activeMissionsCount}
            </strong>
          </span>,
          <span key="wallet" className="inline-flex items-center gap-1">
            <span>رصيد المحفظة:</span>
            <strong
              dir="ltr"
              className="font-mono font-semibold tabular-nums text-[#1F1F1C]"
            >
              ${walletBalance.toFixed(2)}
            </strong>
          </span>,
        ]}
        actions={
          <>
            <button
              type="button"
              data-testid="kashafi-refresh-radar-btn"
              disabled={isLoadingData}
              onClick={() => loadKashafiData()}
              className={WORKSPACE_SECONDARY_BTN_CLASS}
            >
              <RefreshCw
                className={`w-4 h-4 shrink-0 ${
                  isLoadingData ? 'animate-spin text-[#D97757]' : ''
                }`}
              />
              <span>تحديث الرادار</span>
            </button>

            <button
              type="button"
              data-testid="kashafi-manage-wallet-btn"
              onClick={onOpenWalletDrawer}
              className={WORKSPACE_PRIMARY_BTN_CLASS}
            >
              <Wallet className="w-4 h-4 shrink-0" />
              <span>إدارة المحفظة والرصيد</span>
            </button>
          </>
        }
      />

      {orderSuccessToast && (
        <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-display font-bold text-[#1F1F1C]">
            <CheckCircle2 className="w-4 h-4 text-[#D97757] shrink-0" />
            <span>{orderSuccessToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setOrderSuccessToast(null)}
            className="p-1 rounded-lg hover:bg-[#E8DED2] text-[#1F1F1C] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ===================================================================
          SECTION 1: بعثة التحقيق والربط المرجعي الجارية (Redesigned Ticket)
         =================================================================== */}
      <section className="space-y-3">
        <ResearchTicketsView
          kashafiMode
          result={result}
          accountType={accountType}
          userEmail={userEmail}
          userId={resolvedUid}
          userPhone={userPhone}
          isVip={caps.isVip}
          onRequestUpgradeVip={onUpgradeAnnualVip}
          onLogActivity={onLogActivity}
          onAdoptResolvedLineage={onAdoptResolvedLineage}
          onTicketsStatusChange={(status) => {
            setHasActiveResearchTicket(status.hasAnyTicket);
            onTicketsStatusChange?.(status);
          }}
        />
      </section>

      {/* ===================================================================
          SECTION 2: رادار الاكتشافات والبشارات العلمية لعائلتكم (100% Real Data)
         =================================================================== */}
      <section className="space-y-4 pt-5 border-t border-[#D8C7B2]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F5F1E8] border border-[#D97757]/60 flex items-center justify-center text-[#D97757] shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-display font-bold text-[#1F1F1C]">
                رادار الاكتشافات والبشارات العلمية لعائلتكم
              </h2>
              <p className="text-xs text-[#1F1F1C]/70">
                التحديثات الفعلية المعتمدة من مرصد البحوث لعائلة {result.familyName}
                {unreadItemsCount > 0 ? ` · ${unreadItemsCount} جديد غير مقروء` : ''}
              </p>
            </div>
          </div>
        </div>

        {isLoadingData ? (
          <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-6 text-center">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#D97757]" />
          </div>
        ) : kashafiItems.length === 0 ? (
          <div
            data-testid="kashafi-radar-empty-state"
            className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-6 text-right"
          >
            <p className="text-xs sm:text-sm text-[#1F1F1C]/70 leading-relaxed max-w-3xl">
              رادار كشّافي يتابع سجلات عائلتكم لدى مرصد البحوث — ستظهر هنا تلقائياً أي حلقات نسب مكتشفة أو وثائق مرجعية فور رصدها واعتمادها.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {kashafiItems.map((item) => {
              const isExpanded = expandedItemId === item.id;
              return (
                <article
                  key={item.id}
                  className={`rounded-2xl border p-5 transition-colors ${
                    item.isRead
                      ? 'bg-[#F5F1E8] border-[#D8C7B2]'
                      : 'bg-[#F5F1E8] border-[#D97757]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#D97757]">
                        <span className="font-display font-bold">
                          {getItemTypeLabelAr(item.type)}
                        </span>
                        <span aria-hidden="true" className="text-[#D8C7B2]">
                          ·
                        </span>
                        <span className="text-[#1F1F1C]/70">{item.authorName}</span>
                        <span aria-hidden="true" className="text-[#D8C7B2]">
                          ·
                        </span>
                        <span className="text-[#1F1F1C]/70 tabular-nums">
                          {new Date(item.createdAt).toLocaleDateString('ar-SA', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        {!item.isRead && (
                          <>
                            <span aria-hidden="true" className="text-[#D8C7B2]">
                              ·
                            </span>
                            <span className="font-display font-bold text-[#D97757]">
                              جديد
                            </span>
                          </>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-display font-bold text-[#1F1F1C]">
                        {item.title}
                      </h3>

                      <p className="text-xs sm:text-sm text-[#1F1F1C]/70 leading-relaxed">
                        {item.summary}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {(item.details || item.sourceCitation || item.deliverableUrl) && (
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedItemId(isExpanded ? null : item.id);
                            if (!item.isRead) handleMarkItemRead(item);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs font-display font-bold text-[#D97757] cursor-pointer whitespace-nowrap shrink-0"
                        >
                          {isExpanded ? 'إخفاء التفاصيل' : 'عرض التقرير والمصادر'}
                        </button>
                      )}
                      {!item.isRead && (
                        <button
                          type="button"
                          onClick={() => handleMarkItemRead(item)}
                          className="px-3 py-1.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs font-display font-bold text-[#1F1F1C]/70 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>تمت القراءة</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-[#D8C7B2] space-y-2.5 text-xs">
                      {item.details && (
                        <div className="text-[#1F1F1C] leading-relaxed whitespace-pre-line">
                          {item.details}
                        </div>
                      )}
                      {item.sourceCitation && (
                        <div className="text-[#1F1F1C]/70">
                          <strong className="text-[#D97757]">
                            المصدر والمرجع المعتمد:
                          </strong>{' '}
                          {item.sourceCitation}
                        </div>
                      )}
                      {item.deliverableUrl && (
                        <div>
                          <a
                            href={item.deliverableUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[#D97757] hover:text-[#D97757] font-display font-bold underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>فتح الملف أو الوثيقة المرفقة</span>
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================================
          ACTIVE KASHAFI SERVICE ORDERS TRACKER (Only when real orders exist)
         =================================================================== */}
      {orders.length > 0 && (
        <section className="space-y-3 pt-2 border-t border-[#D8C7B2]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] flex items-center justify-center text-[#D97757] shrink-0">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-[#1F1F1C]">
                طلباتك البحثية الجارية في كشّافي ({orders.length})
              </h2>
              <p className="text-xs text-[#1F1F1C]/70">
                حالة الخدمات البحثية المسندة تلقائياً إلى مدير البحوث
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orders.map((ord) => (
              <div
                key={ord.id}
                className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono tabular-nums font-bold text-[#D97757]">
                      #{ord.orderNumber}
                    </span>
                    <span
                      className={`font-display font-bold ${
                        ord.status === 'COMPLETED'
                          ? 'text-[#D97757]'
                          : 'text-[#D97757]'
                      }`}
                    >
                      {getKashafiOrderStatusLabelAr(ord.status)}
                    </span>
                  </div>
                  <h3 className="text-sm font-display font-bold text-[#1F1F1C]">
                    {ord.campaignTitle}
                  </h3>
                  <div className="text-[11px] text-[#1F1F1C]/70 flex flex-wrap items-center gap-2">
                    <span>المسؤول: {ord.assignedResearcherName || 'مدير البحوث'}</span>
                    <span>·</span>
                    <span className="tabular-nums">
                      {ord.includedInPremium
                        ? 'مشمول ضمن الباقة السنوية'
                        : ord.pricePaidUsd > 0
                        ? `$${ord.pricePaidUsd} من المحفظة`
                        : 'مجاني'}
                    </span>
                  </div>
                </div>
                {ord.status === 'COMPLETED' && ord.researcherReport && (
                  <p className="text-xs text-[#1F1F1C]/70 pt-2 border-t border-[#D8C7B2] line-clamp-2">
                    {ord.researcherReport}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===================================================================
          SECTION 3: خدمات ومزايا متاحة للإضافة وإعلانات المنصة (100% Real Published Campaigns ONLY)
         =================================================================== */}
      <section className="space-y-4 pt-2 border-t border-[#D8C7B2]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] flex items-center justify-center text-[#D97757] shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-display font-bold text-[#1F1F1C]">
              خدمات ومزايا متاحة للإضافة وإعلانات المنصة
            </h2>
            <p className="text-xs text-[#1F1F1C]/70">
              البرامج البحثية والخدمات المنشورة فعلياً من إدارة منصة جذوري والمناسبة لحسابكم
            </p>
          </div>
        </div>

        {isLoadingData ? (
          <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-6 text-center">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#D97757]" />
          </div>
        ) : eligibleCampaigns.length === 0 ? (
          <p
            data-testid="kashafi-campaigns-empty-note"
            className="text-xs text-[#1F1F1C]/70 py-2"
          >
            لا توجد خدمات إضافية أو إعلانات موجهة منشورة لحسابكم في الوقت الحالي.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
            {eligibleCampaigns.map((cmp) => {
              const existingOrder = ordersByCampaignId.get(cmp.id);
              const isCoveredByVip = cmp.freeForPremium && caps.isVip;
              const priceText = isCoveredByVip
                ? 'مشمول للبريميوم'
                : cmp.priceUsd > 0
                ? `$${cmp.priceUsd} من المحفظة`
                : 'مجاني';

              return (
                <div
                  key={cmp.id}
                  className="h-full rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-5 flex flex-col justify-between gap-4 hover:border-[#D97757] transition-colors"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs text-[#D97757]">
                      <span className="font-display font-bold">
                        {getKashafiCategoryLabelAr(cmp.category)}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-[#1F1F1C]">
                        {priceText}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-display font-bold text-[#1F1F1C] leading-snug">
                      {cmp.title}
                    </h3>

                    <p className="text-xs text-[#1F1F1C]/70 leading-relaxed">
                      {cmp.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#D8C7B2]">
                    {existingOrder &&
                    existingOrder.status !== 'CANCELLED' ? (
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-display font-bold text-[#D97757]">
                          {existingOrder.status === 'COMPLETED' ? (
                            <CheckCircle2 className="w-4 h-4 text-[#D97757]" />
                          ) : (
                            <Clock className="w-4 h-4 text-[#D97757]" />
                          )}
                          <span>
                            {getKashafiOrderStatusLabelAr(existingOrder.status)}
                          </span>
                        </span>
                        <span className="font-mono tabular-nums text-[11px] text-[#1F1F1C]/70">
                          #{existingOrder.orderNumber}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCampaignCtaClick(cmp)}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#1F1F1C] hover:bg-[#D97757] text-[#D97757] text-xs font-display font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <span>
                          {cmp.ctaLabel ||
                            (cmp.executionMode === 'research_execution'
                              ? 'طلب الخدمة الآن'
                              : 'الانتقال للتفعيل')}
                        </span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================================
          RESEARCH SERVICE ORDER CONFIRMATION MODAL
         =================================================================== */}
      {selectedCampaignForOrder && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1F1F1C]/65 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#F5F1E8] border border-[#D97757] p-6 shadow-2xl space-y-4 text-right">
            <div className="flex items-start justify-between gap-3 border-b border-[#D8C7B2] pb-3">
              <div>
                <div className="text-xs font-display font-bold text-[#D97757]">
                  تأكيد طلب خدمة بحثية وإسنادها لمدير البحوث
                </div>
                <h3 className="text-base font-display font-bold text-[#1F1F1C] mt-1">
                  {selectedCampaignForOrder.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCampaignForOrder(null)}
                className="w-8 h-8 rounded-lg hover:bg-[#F5F1E8] flex items-center justify-center text-[#1F1F1C] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#1F1F1C]/70 leading-relaxed">
              {selectedCampaignForOrder.description}
            </p>

            <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#1F1F1C]/70">جهة التنفيذ المعتمدة:</span>
                <strong className="text-[#1F1F1C]">
                  {selectedCampaignForOrder.assignedResearcherName ||
                    'مدير البحوث (إسناد تلقائي)'}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#1F1F1C]/70">التكلفة المطلوبة:</span>
                <strong className="font-mono tabular-nums text-[#D97757]">
                  {selectedCampaignForOrder.freeForPremium && caps.isVip
                    ? '$0 (مشمول في الباقة السنوية)'
                    : selectedCampaignForOrder.priceUsd > 0
                    ? `$${selectedCampaignForOrder.priceUsd} (خصم من المحفظة)`
                    : 'مجاني ($0)'}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#1F1F1C]/70">رصيد محفظتك الحالي:</span>
                <strong className="font-mono tabular-nums text-[#1F1F1C]">
                  ${walletBalance.toFixed(2)}
                </strong>
              </div>
            </div>

            <div>
              <label className="block text-xs font-display font-bold text-[#1F1F1C] mb-1">
                ملاحظات أو تفاصيل إضافية للباحث (اختياري)
              </label>
              <textarea
                rows={3}
                value={orderCustomerNotes}
                onChange={(e) => setOrderCustomerNotes(e.target.value)}
                placeholder="أضف أي تفاصيل تساعد مدير البحوث في تنفيذ طلبكم بدقة..."
                className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2 text-xs text-[#1F1F1C] focus:bg-[#F5F1E8] focus:outline-none focus:border-[#D97757]"
              />
            </div>

            {orderError && (
              <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] p-3 text-xs text-[#1F1F1C] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p>{orderError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCampaignForOrder(null);
                      onOpenWalletDrawer();
                    }}
                    className="underline font-bold text-[#D97757] cursor-pointer"
                  >
                    فتح المحفظة لشحن الرصيد ←
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8C7B2]">
              <button
                type="button"
                onClick={() => setSelectedCampaignForOrder(null)}
                className="px-4 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs font-display font-bold text-[#1F1F1C]/70 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSubmittingOrder}
                onClick={handleConfirmResearchServiceOrder}
                className="px-5 py-2 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {isSubmittingOrder ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>اعتماد الطلب وإرساله لمدير البحوث</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
