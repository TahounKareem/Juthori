import React, { useEffect, useMemo, useState } from 'react';
import {
  Wallet,
  GitBranch,
  TreePine,
  FolderArchive,
  Globe,
  Users,
  Compass,
  Bell,
  ArrowLeft,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Scroll,
  AlertCircle,
} from 'lucide-react';
import {
  AccountLegalType,
  DashboardAccessCapabilities,
  DashboardTab,
  LineageSearchResult,
  NotificationItem,
} from '../types/juthori';
import {
  CustomerSiteSettingsData,
  ResearchTicketData,
  canonicalCustomerEmailUid,
  fetchUserFamilyTreeFromFirebase,
  fetchUserResearchTickets,
  fetchUserVaultArchive,
  readUserFamilyTreeFromLocal,
  readVaultArchiveFromLocal,
} from '../services/firestoreService';
import {
  KinshipCircleMember,
  TreeEnrichmentRequestDoc,
  fetchKinshipCircleForOwner,
  resolveTicketLifecycleStage,
  subscribeToOwnerEnrichmentRequests,
} from '../services/priority4Service';
import {
  KashafiCampaignRecord,
  KashafiItemRecord,
  KashafiServiceOrderRecord,
  doesCampaignMatchClient,
  fetchActiveKashafiCampaignsForClient,
  fetchCustomerKashafiItems,
  fetchCustomerKashafiOrders,
} from '../services/kashafiService';
import { auth } from '../services/firebase';

interface CustomerHomeOverviewProps {
  result: LineageSearchResult;
  accountType: AccountLegalType;
  caps: DashboardAccessCapabilities;
  walletBalance: number;
  extraTreeCapacity?: number;
  unlockedCapsules: string[];
  unlockedAddonSourceIds: string[];
  userId?: string;
  userEmail: string;
  userPhone?: string;
  siteSettings?: CustomerSiteSettingsData;
  dashboardNotifications: NotificationItem[];
  onNavigateTab: (tab: DashboardTab) => void;
  onOpenWalletDrawer: () => void;
  onOpenNotificationsDrawer: () => void;
  onUnlockRoot5Usd: () => void;
  onUpgradeAnnualVip: () => void;
  onSignCharterAndEnableTree: () => void;
  onLogActivity: (action: string, detail: string) => void;
  onAdoptResolvedLineage?: (enrichedResult: LineageSearchResult) => void;
  onOpenFullResearchTickets?: () => void;
  onTicketsStatusChange?: (status: {
    hasAnyTicket: boolean;
    hasResearcherReplyWaiting: boolean;
  }) => void;
}

function getTicketProgressPercent(
  ticket: ResearchTicketData
): { percent: number; label: string } {
  const stage = resolveTicketLifecycleStage(ticket);
  switch (stage) {
    case 'OPEN':
      return { percent: 20, label: 'استلام الطلب' };
    case 'IN_REVIEW':
      return { percent: 45, label: 'قيد الفحص المرجعي' };
    case 'NEEDS_INFO':
      return { percent: 60, label: 'بانتظار توضيح منكم' };
    case 'RESOLVED':
      return { percent: 90, label: 'اعتماد النتيجة المرجعية' };
    case 'CLOSED':
      return { percent: 100, label: 'مكتملة وموثقة' };
  }
}

export const CustomerHomeOverview: React.FC<CustomerHomeOverviewProps> = ({
  result,
  accountType,
  caps,
  walletBalance,
  extraTreeCapacity = 0,
  unlockedCapsules,
  userId,
  userEmail,
  siteSettings,
  dashboardNotifications,
  onNavigateTab,
  onOpenWalletDrawer,
  onOpenNotificationsDrawer,
  onTicketsStatusChange,
}) => {
  const resolvedUid =
    userId ||
    auth.currentUser?.uid ||
    canonicalCustomerEmailUid(userEmail) ||
    `usr_${userEmail.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  // 1. Live Real Counts across the 6 Workspace Pillars
  const [treeMembersCount, setTreeMembersCount] = useState<number>(() => {
    const local = readUserFamilyTreeFromLocal(
      resolvedUid,
      result.familyName,
      userEmail
    );
    return Array.isArray(local) ? local.length : 0;
  });

  const [vaultStats, setVaultStats] = useState<{
    itemsCount: number;
    foldersCount: number;
  }>(() => {
    const local = readVaultArchiveFromLocal(
      resolvedUid,
      result.familyName,
      userEmail
    );
    return {
      itemsCount: local?.items?.length || 0,
      foldersCount: local?.folders?.length || 0,
    };
  });

  const siteInfo = useMemo(
    () => ({
      isPublished: Boolean(siteSettings?.isPublished),
      slug: siteSettings?.siteSubdomain || '',
    }),
    [siteSettings?.isPublished, siteSettings?.siteSubdomain]
  );

  const [relativesCount, setRelativesCount] = useState<number>(0);
  const [pendingEnrichments, setPendingEnrichments] = useState<number>(0);
  const communityStats = useMemo(
    () => ({ relativesCount, pendingEnrichments }),
    [relativesCount, pendingEnrichments]
  );

  const [tickets, setTickets] = useState<ResearchTicketData[]>([]);
  const [kashafiItems, setKashafiItems] = useState<KashafiItemRecord[]>([]);
  const [kashafiCampaigns, setKashafiCampaigns] = useState<
    KashafiCampaignRecord[]
  >([]);
  const [kashafiOrders, setKashafiOrders] = useState<
    KashafiServiceOrderRecord[]
  >([]);

  useEffect(() => {
    const unsub = subscribeToOwnerEnrichmentRequests(
      resolvedUid,
      (items: TreeEnrichmentRequestDoc[]) => {
        const pending = items.filter(
          (r) => r.status === 'PENDING_REGISTRAR_APPROVAL'
        ).length;
        setPendingEnrichments(pending);
      }
    );
    return () => {
      try {
        unsub();
      } catch {
        // ignore unsubscribe cleanup error
      }
    };
  }, [resolvedUid]);

  useEffect(() => {
    let cancelled = false;

    const loadAllRealMetrics = async () => {
      const [
        treeRes,
        vaultRes,
        kinshipRes,
        ticketsRes,
        kItemsRes,
        kCampaignsRes,
        kOrdersRes,
      ] = await Promise.allSettled([
        fetchUserFamilyTreeFromFirebase(
          resolvedUid,
          result.familyName,
          userEmail
        ),
        fetchUserVaultArchive(resolvedUid, result.familyName, userEmail),
        fetchKinshipCircleForOwner(resolvedUid),
        fetchUserResearchTickets(resolvedUid, userEmail),
        fetchCustomerKashafiItems(resolvedUid, userEmail),
        fetchActiveKashafiCampaignsForClient(),
        fetchCustomerKashafiOrders(resolvedUid, userEmail),
      ]);

      if (cancelled) return;

      if (treeRes.status === 'fulfilled' && Array.isArray(treeRes.value)) {
        setTreeMembersCount(treeRes.value.length);
      }

      if (vaultRes.status === 'fulfilled' && vaultRes.value) {
        setVaultStats({
          itemsCount: vaultRes.value.items?.length || 0,
          foldersCount: vaultRes.value.folders?.length || 0,
        });
      }

      const relatives =
        kinshipRes.status === 'fulfilled' && kinshipRes.value?.members
          ? kinshipRes.value.members.filter(
              (m: KinshipCircleMember) => m.status !== 'OPTED_OUT'
            ).length
          : 0;
      setRelativesCount(relatives);

      const realTickets =
        ticketsRes.status === 'fulfilled' && Array.isArray(ticketsRes.value)
          ? ticketsRes.value
          : [];
      setTickets(realTickets);

      const waiting = realTickets.some((t) => {
        if (t.status === 'NEEDS_INFO' || t.lifecycleStage === 'NEEDS_INFO') {
          return true;
        }
        const msgs = t.messages || [];
        const lastMsg = msgs[msgs.length - 1];
        return Boolean(lastMsg && lastMsg.senderRole === 'researcher');
      });
      onTicketsStatusChange?.({
        hasAnyTicket: realTickets.length > 0,
        hasResearcherReplyWaiting: waiting,
      });

      if (kItemsRes.status === 'fulfilled') {
        setKashafiItems(kItemsRes.value);
      }
      if (kCampaignsRes.status === 'fulfilled') {
        setKashafiCampaigns(kCampaignsRes.value);
      }
      if (kOrdersRes.status === 'fulfilled') {
        setKashafiOrders(kOrdersRes.value);
      }
    };

    loadAllRealMetrics();
    return () => {
      cancelled = true;
    };
  }, [resolvedUid, userEmail, result.familyName]);

  const activeTicket = useMemo(() => {
    return (
      tickets.find((t) => {
        const st = resolveTicketLifecycleStage(t);
        if (st === 'CLOSED') return false;
        if (st === 'RESOLVED' && t.resolutionPayload?.appliedByCustomerAt) {
          return false;
        }
        return true;
      }) || null
    );
  }, [tickets]);

  const matchingCampaignsCount = useMemo(
    () =>
      kashafiCampaigns.filter((cmp) =>
        doesCampaignMatchClient(cmp, {
          familyName: result.familyName,
          isVip: caps.isVip,
          vaultItemsCount: vaultStats.itemsCount,
          treeMembersCount,
        })
      ).length,
    [
      kashafiCampaigns,
      result.familyName,
      caps.isVip,
      vaultStats.itemsCount,
      treeMembersCount,
    ]
  );

  const activeKashafiOrder = useMemo(
    () => kashafiOrders.find((o) => o.status !== 'CANCELLED') || null,
    [kashafiOrders]
  );

  const latestKashafiItem = kashafiItems[0] || null;
  const unreadKashafiItemsCount = kashafiItems.filter((i) => !i.isRead).length;

  const totalTreeCapacity = (caps.maxTreeMembers || 250) + extraTreeCapacity;
  const totalCapsules = result.capsules?.length || 0;
  const unlockedCapsulesCount = unlockedCapsules?.length || 0;

  const clientDisplayName =
    [result.clientName, result.familyName]
      .filter((s) => s && s !== '—')
      .join(' ') ||
    result.familyName ||
    'عضو جذوري';

  const roleLabel =
    accountType === AccountLegalType.RecordKeeper
      ? 'رب أسرة / أمين سجل'
      : 'حساب فردي';

  const latestThreeAlerts = useMemo(
    () => (dashboardNotifications || []).slice(0, 3),
    [dashboardNotifications]
  );

  const activeTicketProgress = activeTicket
    ? getTicketProgressPercent(activeTicket)
    : null;

  return (
    <div
      data-testid="customer-home-executive-hub"
      className="space-y-6 text-[#252321]"
    >
      {/* ===================================================================
          TIER 1 — Hero Welcome & Wallet Strip
         =================================================================== */}
      <section className="rounded-2xl bg-[#FFFDF9] border border-[#E2DACB] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#8D4925]">
            <span className="font-display font-bold">
              {caps.tierHeaderTitle || 'عضوية جذوري'}
            </span>
            <span aria-hidden="true" className="text-[#D8D0C0]">
              ·
            </span>
            <span className="text-[#5C5346] font-semibold">{roleLabel}</span>
            {result.originCountry && (
              <>
                <span aria-hidden="true" className="text-[#D8D0C0]">
                  ·
                </span>
                <span className="text-[#6E6456]">
                  {result.originCountry}
                  {result.originRegion ? ` — ${result.originRegion}` : ''}
                </span>
              </>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-display font-bold text-[#252321]">
            أهلاً بك، {clientDisplayName} — أسرة {result.familyName}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="px-4 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#E2DACB] flex items-center gap-2.5">
            <Wallet className="w-4 h-4 text-[#8D4925]" />
            <div className="text-xs">
              <span className="text-[#6E6456] ml-1.5">رصيد المحفظة:</span>
              <strong className="font-mono tabular-nums text-sm font-bold text-[#252321]">
                ${walletBalance.toFixed(2)}
              </strong>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenWalletDrawer}
            className="px-4 py-2.5 rounded-xl bg-[#252321] hover:bg-[#8D4925] text-[#F3D299] text-xs font-display font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            الاشتراكات والمكافآت
          </button>
        </div>
      </section>

      {/* ===================================================================
          TIER 2 — 6 Equal-Height Summary Cards (3 × 2 Grid)
         =================================================================== */}
      <section
        aria-label="ملخص أركان الحساب الستة"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch"
      >
        {/* Card 1: عمود نسبي */}
        <div className="h-full rounded-2xl bg-[#FFFDF9] border border-[#E2DACB] p-5 flex flex-col justify-between gap-4 hover:border-[#C5A059] transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] border border-[#E2DACB] flex items-center justify-center text-[#8D4925] shrink-0">
                  <GitBranch className="w-4 h-4" />
                </div>
                <h2 className="text-base font-display font-bold text-[#252321]">
                  عمود نسبي
                </h2>
              </div>
              <span className="text-[11px] font-display font-bold text-[#8D4925]">
                {result.matched ? 'ربط مرجعي متاح' : 'قيد التحقيق'}
              </span>
            </div>

            <div className="space-y-1 text-xs text-[#5C5346]">
              <div>
                الجذر الموثق:{' '}
                <strong className="text-[#252321]">
                  {result.matched
                    ? result.rootTribeName || result.rootBranchName || 'موثق بالمرصد'
                    : 'قيد الفحص والتحقيق المرجعي'}
                </strong>
              </div>
              <div className="tabular-nums">
                كبسولات الأجداد الوسيطين:{' '}
                <strong className="text-[#252321]">
                  {unlockedCapsulesCount} / {totalCapsules}
                </strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab(DashboardTab.Lineage)}
            className="w-full py-2.5 px-4 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#E2DACB] text-xs font-display font-bold text-[#8D4925] inline-flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>استعراض العمود</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 2: شجرتي */}
        <div className="h-full rounded-2xl bg-[#FFFDF9] border border-[#E2DACB] p-5 flex flex-col justify-between gap-4 hover:border-[#C5A059] transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] border border-[#E2DACB] flex items-center justify-center text-[#8D4925] shrink-0">
                  <TreePine className="w-4 h-4" />
                </div>
                <h2 className="text-base font-display font-bold text-[#252321]">
                  شجرتي
                </h2>
              </div>
              <span className="text-[11px] font-mono tabular-nums font-bold text-[#6E6456]">
                {treeMembersCount} / {totalTreeCapacity}
              </span>
            </div>

            <div className="space-y-1 text-xs text-[#5C5346]">
              <div className="tabular-nums">
                الأفراد المسجلون في المشجرة:{' '}
                <strong className="text-[#252321]">
                  {treeMembersCount} فرداً
                </strong>
              </div>
              <div className="tabular-nums">
                السعة المتاحة حالياً:{' '}
                <strong className="text-[#252321]">
                  {Math.max(0, totalTreeCapacity - treeMembersCount)} مقعداً
                </strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab(DashboardTab.MyTree)}
            className="w-full py-2.5 px-4 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#E2DACB] text-xs font-display font-bold text-[#8D4925] inline-flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>فتح استوديو الشجرة</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 3: خزانتي */}
        <div className="h-full rounded-2xl bg-[#FFFDF9] border border-[#E2DACB] p-5 flex flex-col justify-between gap-4 hover:border-[#C5A059] transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] border border-[#E2DACB] flex items-center justify-center text-[#8D4925] shrink-0">
                  <FolderArchive className="w-4 h-4" />
                </div>
                <h2 className="text-base font-display font-bold text-[#252321]">
                  خزانتي
                </h2>
              </div>
              <span className="text-[11px] font-mono tabular-nums font-bold text-[#6E6456]">
                {vaultStats.itemsCount} وثيقة
              </span>
            </div>

            <div className="space-y-1 text-xs text-[#5C5346]">
              <div className="tabular-nums">
                الوثائق والصور المؤرشفة:{' '}
                <strong className="text-[#252321]">
                  {vaultStats.itemsCount} ملفاً
                </strong>
              </div>
              <div className="tabular-nums">
                مجلدات الأرشيف العائلي:{' '}
                <strong className="text-[#252321]">
                  {vaultStats.foldersCount} مجلدات
                </strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab(DashboardTab.MyVault)}
            className="w-full py-2.5 px-4 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#E2DACB] text-xs font-display font-bold text-[#8D4925] inline-flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>إدارة الخزانة</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 4: موقعي */}
        <div className="h-full rounded-2xl bg-[#FFFDF9] border border-[#E2DACB] p-5 flex flex-col justify-between gap-4 hover:border-[#C5A059] transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] border border-[#E2DACB] flex items-center justify-center text-[#8D4925] shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
                <h2 className="text-base font-display font-bold text-[#252321]">
                  موقعي
                </h2>
              </div>
              <span
                className={`text-[11px] font-display font-bold ${
                  siteInfo.isPublished ? 'text-emerald-700' : 'text-[#8C8272]'
                }`}
              >
                {siteInfo.isPublished ? 'منشور' : 'مسودة خاصة'}
              </span>
            </div>

            <div className="space-y-1 text-xs text-[#5C5346]">
              <div>
                الرابط السيادي:{' '}
                <strong className="font-mono text-[#252321]" dir="ltr">
                  {siteInfo.slug ? `juthori.com/${siteInfo.slug}` : 'لم يُحجز بعد'}
                </strong>
              </div>
              <div>
                حالة النشر:{' '}
                <strong className="text-[#252321]">
                  {siteInfo.isPublished
                    ? 'متاح وفق ضوابط الخصوصية'
                    : 'بانتظار التفعيل والنشر'}
                </strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab(DashboardTab.MySite)}
            className="w-full py-2.5 px-4 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#E2DACB] text-xs font-display font-bold text-[#8D4925] inline-flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>إعدادات موقعي</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 5: مجتمعي */}
        <div className="h-full rounded-2xl bg-[#FFFDF9] border border-[#E2DACB] p-5 flex flex-col justify-between gap-4 hover:border-[#C5A059] transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] border border-[#E2DACB] flex items-center justify-center text-[#8D4925] shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <h2 className="text-base font-display font-bold text-[#252321]">
                  مجتمعي
                </h2>
              </div>
              <span className="text-[11px] font-mono tabular-nums font-bold text-[#6E6456]">
                {communityStats.relativesCount} قريب
              </span>
            </div>

            <div className="space-y-1 text-xs text-[#5C5346]">
              <div className="tabular-nums">
                الأقارب المنضمون للدائرة:{' '}
                <strong className="text-[#252321]">
                  {communityStats.relativesCount} عضواً
                </strong>
              </div>
              <div className="tabular-nums">
                طلبات الإثراء بانتظار المراجعة:{' '}
                <strong className="text-[#252321]">
                  {communityStats.pendingEnrichments} طلب
                </strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab(DashboardTab.MyCommunity)}
            className="w-full py-2.5 px-4 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#E2DACB] text-xs font-display font-bold text-[#8D4925] inline-flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>إدارة دائرة الأقارب</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 6: كشّافي ✦ (Distinct Soft Gold Border) */}
        <div className="h-full rounded-2xl bg-gradient-to-br from-[#FFFDF9] to-[#FAF4E4] border-2 border-[#C5A059] p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#8D4925] text-[#F3D299] flex items-center justify-center shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <h2 className="text-base font-display font-bold text-[#252321]">
                  كشّافي ✦
                </h2>
              </div>
              {unreadKashafiItemsCount > 0 && (
                <span className="text-[11px] font-display font-bold text-[#D8755B] tabular-nums">
                  {unreadKashafiItemsCount} جديد
                </span>
              )}
            </div>

            <div className="space-y-1 text-xs text-[#5C5346]">
              <div>
                حالة التحقيق:{' '}
                <strong className="text-[#252321]">
                  {activeTicket
                    ? `بعثة جارية (#${activeTicket.ticketNumber})`
                    : 'لا توجد بعثة مفتوحة'}
                </strong>
              </div>
              <div className="tabular-nums">
                رادار الاكتشافات والخدمات:{' '}
                <strong className="text-[#252321]">
                  {kashafiItems.length} اكتشاف · {matchingCampaignsCount} خدمة متاحة
                </strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab(DashboardTab.MyExplorer)}
            className="w-full py-2.5 px-4 rounded-xl bg-[#8D4925] hover:bg-[#733a1d] text-[#FAF4E4] text-xs font-display font-bold inline-flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>استكشاف كشّافي</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* ===================================================================
          TIER 3 — 2 Compact Bottom Columns (NO chat boxes or forms!)
         =================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* Right Column: نبض كشّافي الجاري */}
        <div
          data-testid="home-kashafi-pulse-card"
          className="h-full rounded-2xl bg-[#FFFDF9] border border-[#E2DACB] p-5 flex flex-col justify-between gap-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EDE6DA]">
              <div className="flex items-center gap-2">
                <Scroll className="w-4 h-4 text-[#D8755B]" />
                <h2 className="text-sm sm:text-base font-display font-bold text-[#252321]">
                  نبض كشّافي الجاري
                </h2>
              </div>
              {activeTicket && (
                <span
                  dir="ltr"
                  className="font-mono tabular-nums text-xs font-bold text-[#8D4925]"
                >
                  #{activeTicket.ticketNumber}
                </span>
              )}
            </div>

            {activeTicket && activeTicketProgress ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-sm font-display font-bold text-[#252321]">
                    {activeTicket.targetAncestor ||
                      `بعثة تحقيق نسب أسرة ${result.familyName}`}
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#6E6456]">
                    <span className="inline-flex items-center gap-1.5">
                      {resolveTicketLifecycleStage(activeTicket) ===
                      'NEEDS_INFO' ? (
                        <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-[#D8755B]" />
                      )}
                      <span>المرحلة الحالية: {activeTicketProgress.label}</span>
                    </span>
                    <span className="font-mono tabular-nums font-bold text-[#8D4925]">
                      {activeTicketProgress.percent}%
                    </span>
                  </div>
                </div>

                {/* Slim Horizontal Progress Bar */}
                <div className="h-2 rounded-full bg-[#EDE6DA] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#D8755B] transition-all duration-300"
                    style={{ width: `${activeTicketProgress.percent}%` }}
                  />
                </div>
              </div>
            ) : activeKashafiOrder ? (
              <div className="space-y-1.5 text-xs">
                <div className="text-sm font-display font-bold text-[#252321]">
                  {activeKashafiOrder.campaignTitle}
                </div>
                <p className="text-[#6E6456]">
                  الطلب #{activeKashafiOrder.orderNumber} — قيد المتابعة لدى{' '}
                  <strong className="text-[#8D4925]">
                    {activeKashafiOrder.assignedResearcherName || 'مدير البحوث'}
                  </strong>
                </p>
              </div>
            ) : latestKashafiItem ? (
              <div className="space-y-1.5 text-xs">
                <div className="text-sm font-display font-bold text-[#252321]">
                  {latestKashafiItem.title}
                </div>
                <p className="text-[#6E6456] line-clamp-2">
                  {latestKashafiItem.summary}
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#6E6456] py-2">
                لا توجد بعثة تحقيق مفتوحة حالياً — يتابع مرصد البحوث سجلات عائلتكم ويعرض أي مستجدات هنا تلقائياً.
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-[#EDE6DA] flex justify-end">
            <button
              type="button"
              onClick={() => onNavigateTab(DashboardTab.MyExplorer)}
              className="text-xs font-display font-bold text-[#8D4925] hover:text-[#D8755B] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>متابعة التفاصيل والمحادثة في كشّافي</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Left Column: أحدث التنبيهات والرسائل الواردة (Max 3 Real Alerts) */}
        <div
          data-testid="home-latest-alerts-card"
          className="h-full rounded-2xl bg-[#FFFDF9] border border-[#E2DACB] p-5 flex flex-col justify-between gap-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EDE6DA]">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#8D4925]" />
                <h2 className="text-sm sm:text-base font-display font-bold text-[#252321]">
                  أحدث التنبيهات والرسائل الواردة
                </h2>
              </div>
              {dashboardNotifications.length > 0 && (
                <span className="text-[11px] font-mono tabular-nums text-[#8C8272]">
                  {dashboardNotifications.length} سجل
                </span>
              )}
            </div>

            {latestThreeAlerts.length === 0 ? (
              <p className="text-xs text-[#6E6456] py-2">
                لا توجد تنبيهات أو رسائل واردة في السجل حالياً.
              </p>
            ) : (
              <ul className="divide-y divide-[#EDE6DA]">
                {latestThreeAlerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-xs font-display font-bold text-[#252321] truncate flex items-center gap-1.5">
                        {alert.unread ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-[#D8755B] shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#8C8272] shrink-0" />
                        )}
                        <span className="truncate">{alert.title}</span>
                      </div>
                      <p className="text-[11px] text-[#6E6456] line-clamp-1">
                        {alert.body}
                      </p>
                    </div>
                    <span className="text-[10px] text-[#8C8272] whitespace-nowrap shrink-0 tabular-nums">
                      {alert.timestamp}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pt-2 border-t border-[#EDE6DA] flex justify-end">
            <button
              type="button"
              onClick={onOpenNotificationsDrawer}
              className="text-xs font-display font-bold text-[#8D4925] hover:text-[#D8755B] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>عرض السجل الكامل</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
