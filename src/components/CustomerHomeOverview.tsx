import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  FolderArchive,
  GitBranch,
  Globe,
  Scroll,
  ShieldCheck,
  Sparkles,
  TreePine,
  Users,
  Wallet,
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
  PublicMicrositeData,
  TreeEnrichmentRequestDoc,
  fetchKinshipCircleForOwner,
  fetchOwnerMicrositeForCommunity,
  normalizePublicSiteSlug,
  normalizeVisualBranding,
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
import {
  ACTIVE_PUBLIC_SITE_DISPLAY_HOST,
  FamilySiteThemeId,
} from '../config/referralAndSiteConfig';
import { auth } from '../services/firebase';
import {
  KashafiRadarVisual,
  KinshipOrbitVisual,
  LineageGlowPathVisual,
  SiteMiniBrowserVisual,
  TreeBranchGaugeVisual,
  VaultPolaroidFanVisual,
} from './HomeBentoMicroVisuals';
import {
  HeritagePlaqueOrnamentLayer,
  WORKSPACE_PRIMARY_BTN_CLASS,
} from './UnifiedWorkspaceHeader';
import {
  RoyalRoleFamilyBadge,
  resolveRoyalRoleLabel,
} from './RoyalRoleFamilyBadge';

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

function normalizeLocationToken(val?: string): string {
  return (val || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^ال/, '')
    .toLowerCase();
}

const UNSPECIFIED_LOCATION_TOKENS = new Set([
  '',
  '-',
  '—',
  '–',
  'غير محدد',
  'غير محددة',
  'غير معروف',
  'غير معروفة',
  'لا يوجد',
  'none',
  'null',
  'undefined',
  'n/a',
  'unknown',
]);

function sanitizeUserEnteredLocation(val?: string): string {
  const trimmed = (val || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  if (UNSPECIFIED_LOCATION_TOKENS.has(trimmed.toLowerCase())) return '';
  return trimmed;
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

  // 1. Live Real Data Across the 6 Workspace Pillars (STRICT ZERO MOCKUPS)
  const [treeMembersCount, setTreeMembersCount] = useState<number>(() => {
    const local = readUserFamilyTreeFromLocal(
      resolvedUid,
      result.familyName,
      userEmail
    );
    return Array.isArray(local) ? local.length : 0;
  });

  const [vaultState, setVaultState] = useState<{
    itemsCount: number;
    foldersCount: number;
    previewPhotos: Array<{ id: string; title: string; url: string }>;
  }>(() => {
    const local = readVaultArchiveFromLocal(
      resolvedUid,
      result.familyName,
      userEmail
    );
    const items = local?.items || [];
    const previews = items
      .filter((it) => Boolean(it.thumbnailDataUrl || it.fileDataUrl))
      .slice(0, 3)
      .map((it) => ({
        id: it.id,
        title: it.title || 'صورة عائلية',
        url: it.thumbnailDataUrl || it.fileDataUrl,
      }));
    return {
      itemsCount: items.length,
      foldersCount: local?.folders?.length || 0,
      previewPhotos: previews,
    };
  });

  const [ownerMicrosite, setOwnerMicrosite] =
    useState<PublicMicrositeData | null>(null);

  const [circleMembers, setCircleMembers] = useState<KinshipCircleMember[]>([]);
  const [pendingEnrichments, setPendingEnrichments] = useState<number>(0);

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
        // Ignore cleanup error
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
        micrositeRes,
        ticketsRes,
        kItemsRes,
        kCampaignsRes,
        kOrdersRes,
      ] = await Promise.allSettled([
        fetchUserFamilyTreeFromFirebase(
          resolvedUid,
          userEmail,
          result.familyName
        ),
        fetchUserVaultArchive(resolvedUid, result.familyName, userEmail),
        fetchKinshipCircleForOwner(resolvedUid),
        fetchOwnerMicrositeForCommunity(
          resolvedUid,
          siteSettings?.siteSubdomain
        ),
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
        const items = vaultRes.value.items || [];
        const previews = items
          .filter((it) => Boolean(it.thumbnailDataUrl || it.fileDataUrl))
          .slice(0, 3)
          .map((it) => ({
            id: it.id,
            title: it.title || 'صورة عائلية',
            url: it.thumbnailDataUrl || it.fileDataUrl,
          }));
        setVaultState({
          itemsCount: items.length,
          foldersCount: vaultRes.value.folders?.length || 0,
          previewPhotos: previews,
        });
      }

      if (kinshipRes.status === 'fulfilled' && kinshipRes.value?.members) {
        const activeMembers = kinshipRes.value.members.filter(
          (m: KinshipCircleMember) => m.status !== 'OPTED_OUT'
        );
        setCircleMembers(activeMembers);
      }

      if (micrositeRes.status === 'fulfilled' && micrositeRes.value) {
        setOwnerMicrosite(micrositeRes.value);
      }

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
  }, [resolvedUid, userEmail, result.familyName, siteSettings?.siteSubdomain]);

  // Derived Real State (strictly reflecting the client's actual customized site & slug)
  const siteInfo = useMemo(() => {
    let parsedSettingsBranding: Record<string, unknown> | null = null;
    if (siteSettings?.visualBrandingJson) {
      try {
        parsedSettingsBranding = JSON.parse(siteSettings.visualBrandingJson);
      } catch {
        parsedSettingsBranding = null;
      }
    }

    const settingsSlug = normalizePublicSiteSlug(
      siteSettings?.siteSubdomain || ''
    );
    const micrositeSlug = normalizePublicSiteSlug(
      ownerMicrosite?.siteSlug || ''
    );
    const resolvedSlug = settingsSlug || micrositeSlug || '';

    const resolvedThemeId = (siteSettings?.themeId ||
      ownerMicrosite?.themeId ||
      'golden_parchment') as FamilySiteThemeId;

    const resolvedBranding = normalizeVisualBranding(
      (parsedSettingsBranding ||
        ownerMicrosite?.visualBranding ||
        undefined) as Parameters<typeof normalizeVisualBranding>[0],
      result.familyName
    );

    const resolvedTitle =
      (siteSettings?.bioTitle || ownerMicrosite?.bioTitle || '').trim() ||
      `ديوان وسجل عائلة ${result.familyName || 'العائلة'}`;

    const resolvedEmblem = (
      siteSettings?.emblemTag ||
      ownerMicrosite?.familyEmblemTag ||
      ''
    ).trim();

    return {
      isPublished: Boolean(
        siteSettings?.isPublished ?? ownerMicrosite?.isPublished
      ),
      slug: resolvedSlug,
      themeId: resolvedThemeId,
      bioTitle: resolvedTitle,
      emblemTag: resolvedEmblem,
      visualBranding: resolvedBranding,
    };
  }, [
    ownerMicrosite?.isPublished,
    ownerMicrosite?.siteSlug,
    ownerMicrosite?.themeId,
    ownerMicrosite?.bioTitle,
    ownerMicrosite?.familyEmblemTag,
    ownerMicrosite?.visualBranding,
    siteSettings?.isPublished,
    siteSettings?.siteSubdomain,
    siteSettings?.themeId,
    siteSettings?.bioTitle,
    siteSettings?.emblemTag,
    siteSettings?.visualBrandingJson,
    result.familyName,
  ]);

  const relativesCount = circleMembers.length;

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
          vaultItemsCount: vaultState.itemsCount,
          treeMembersCount,
        })
      ).length,
    [
      kashafiCampaigns,
      result.familyName,
      caps.isVip,
      vaultState.itemsCount,
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

  const cleanUserFirstName = useMemo(() => {
    const client = (result.clientName || '').trim();
    return client && client !== '—' && client !== '-' ? client : '';
  }, [result.clientName]);

  const greetingHeading = cleanUserFirstName
    ? `أهلاً بك، ${cleanUserFirstName}`
    : 'أهلاً بك في منصتك التراثية';

  const heroRoleLabel = resolveRoyalRoleLabel({
    accountType,
    hasRegistrarBadge: caps.hasRegistrarBadge,
    isVerifiedOrVip: caps.isVip || caps.isRootUnlocked,
  });

  // Interactive 5-Milestone Family Legacy Journey (100% Real Firestore State)
  const legacyMilestones = useMemo(() => {
    const list: Array<{
      id: string;
      stepNum: number;
      label: string;
      completed: boolean;
      tab: DashboardTab;
    }> = [
      {
        id: 'root',
        stepNum: 1,
        label: 'توثيق الجذر',
        completed: Boolean(caps.isRootUnlocked || (result.matched && caps.isVip)),
        tab: DashboardTab.Lineage,
      },
      {
        id: 'tree',
        stepNum: 2,
        label: 'تأسيس المشجرة',
        completed: treeMembersCount > 0,
        tab: DashboardTab.MyTree,
      },
      {
        id: 'vault',
        stepNum: 3,
        label: 'إيداع الخزانة',
        completed: vaultState.itemsCount > 0,
        tab: DashboardTab.MyVault,
      },
      {
        id: 'site',
        stepNum: 4,
        label: 'تدشين بوابة موقعي',
        completed: siteInfo.isPublished,
        tab: DashboardTab.MySite,
      },
      {
        id: 'community',
        stepNum: 5,
        label: 'تفعيل دائرة الرحم',
        completed: relativesCount > 0,
        tab: DashboardTab.MyCommunity,
      },
    ];
    return list;
  }, [
    caps.isRootUnlocked,
    caps.isVip,
    result.matched,
    treeMembersCount,
    vaultState.itemsCount,
    siteInfo.isPublished,
    relativesCount,
  ]);

  const completedMilestonesCount = legacyMilestones.filter(
    (m) => m.completed
  ).length;
  const legacyCompletionPercent = Math.round(
    (completedMilestonesCount / legacyMilestones.length) * 100
  );
  const nextPendingMilestoneId =
    legacyMilestones.find((m) => !m.completed)?.id || null;

  const latestThreeAlerts = useMemo(
    () => (dashboardNotifications || []).slice(0, 3),
    [dashboardNotifications]
  );

  const activeTicketProgress = activeTicket
    ? getTicketProgressPercent(activeTicket)
    : null;

  const verifiedRootDisplay = result.matched
    ? result.rootTribeName || result.rootBranchName || 'موثق بالمرصد'
    : 'قيد الفحص والتحقيق المرجعي';

  return (
    <div
      data-testid="customer-home-executive-hub"
      className="w-full space-y-6 text-[#252321]"
    >
      {/* ===================================================================
          TIER 1 — Royal Hero & Gamified Legacy Journey Compass
         =================================================================== */}
      <section className="group relative rounded-2xl bg-gradient-to-l from-[#FCF8F0] via-[#FDFBF7] to-[#FAF5EA] border border-[#E6DAC3] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_18px_-6px_rgba(44,30,20,0.05)]">
        {/* Shared Masked Heritage Filigree Watermark, Specular Gold Crest & Micro Corner Filigrees */}
        <HeritagePlaqueOrnamentLayer scale="hero" />

        <div className="relative z-10 p-5 sm:p-7 space-y-6">
          {/* Top Row: Pure Greeting + Royal Role/Family Badge | Wallet & Subscriptions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="inline-flex items-center flex-wrap gap-3 min-w-0">
              <h1 className="text-xl sm:text-2xl font-display font-bold text-[#252321] leading-normal">
                {greetingHeading}
              </h1>
              <RoyalRoleFamilyBadge
                testId="home-royal-role-family-badge"
                roleLabel={heroRoleLabel}
                familyName={result.familyName}
                variant="hero"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <div className="h-10 px-4 rounded-xl bg-white border border-[#E2D5BE] flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#8C5327] shrink-0" />
                <div className="text-[12.5px] flex items-center gap-1.5">
                  <span className="text-[#7A6855]">رصيد المحفظة:</span>
                  <strong
                    dir="ltr"
                    className="inline-block font-mono tabular-nums text-[13px] font-bold text-[#2C1E14]"
                  >
                    ${walletBalance.toFixed(2)}
                  </strong>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenWalletDrawer}
                className={WORKSPACE_PRIMARY_BTN_CLASS}
              >
                الاشتراكات والمكافآت
              </button>
            </div>
          </div>

          {/* Interactive Family Legacy Milestones Compass */}
          <div className="pt-4 border-t border-[#D8C4A0]/60 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <Sparkles className="w-3.5 h-3.5 text-[#9E6B2B]" />
                <span className="font-display font-bold text-[#252321]">
                  مسار اكتمال صرح العائلة
                </span>
                <span className="text-[#6E6456] hidden sm:inline">
                  — انقر على أي محطة للانتقال المباشر وإنجازها
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs tabular-nums">
                <span className="text-[#6E6456]">
                  {completedMilestonesCount} من {legacyMilestones.length} محطات
                </span>
                <span className="font-mono font-bold text-[#8D4925]">
                  {legacyCompletionPercent}%
                </span>
              </div>
            </div>

            {/* 5 Connected Golden Milestones */}
            <div className="relative">
              {/* Connecting golden horizontal line (visible on md+) */}
              <div
                aria-hidden="true"
                className="hidden md:block absolute top-4.5 inset-x-10 h-[2px] bg-[#DFCFAF]"
              >
                <div
                  className="h-full bg-gradient-to-l from-[#D4AF6A] to-[#8D4925] transition-all duration-500"
                  style={{ width: `${legacyCompletionPercent}%` }}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {legacyMilestones.map((m) => {
                  const isNext = m.id === nextPendingMilestoneId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onNavigateTab(m.tab)}
                      className={`group relative z-10 rounded-xl px-3 py-2.5 flex md:flex-col items-center gap-2 text-right md:text-center transition-all duration-300 cursor-pointer border ${
                        m.completed
                          ? 'bg-white/85 border-[#D4AF6A]/65 hover:border-[#8D4925]'
                          : isNext
                          ? 'bg-white border-[#D4AF6A] shadow-xs ring-2 ring-[#D4AF6A]/30 hover:-translate-y-0.5'
                          : 'bg-white/55 border-[#DFD2BC]/75 hover:bg-white/85 hover:border-[#C8A666]'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono font-bold shrink-0 transition-transform duration-300 group-hover:scale-105 ${
                          m.completed
                            ? 'bg-gradient-to-br from-[#D4AF6A] to-[#9E6B2B] text-white shadow-xs'
                            : isNext
                            ? 'bg-[#252321] text-[#F3D299] ring-4 ring-[#D4AF6A]/25'
                            : 'bg-[#EFE6D6] text-[#6E6456]'
                        }`}
                      >
                        {m.completed ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          m.stepNum
                        )}
                      </div>

                      <div className="min-w-0">
                        <div
                          className={`text-[11px] font-display font-bold truncate ${
                            m.completed
                              ? 'text-[#252321]'
                              : isNext
                              ? 'text-[#8D4925]'
                              : 'text-[#5C5346]'
                          }`}
                        >
                          {m.label}
                        </div>
                        <div className="text-[10px] text-[#7A6F5F] hidden sm:block">
                          {m.completed
                            ? 'مكتمل ✓'
                            : isNext
                            ? 'الخطوة التالية'
                            : 'بانتظار الإنجاز'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          TIER 2 — Asymmetric Luxury Bento Grid (12 Columns) + Micro-Canvases
         =================================================================== */}
      <section
        aria-label="أجنحة وحزم منصة جذوري"
        className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch"
      >
        {/* 1. جناح «عمود نسبي» (Row 1 — 6 Columns, Warm Antique Manuscript Parchment) */}
        <article className="group lg:col-span-6 h-full rounded-2xl bg-gradient-to-bl from-[#FCF8F0] via-[#F9F2E4] to-[#F3E8D3] border border-[#D4BC91]/70 p-5 sm:p-6 flex flex-col justify-between gap-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-[#C59B47]">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#252321] text-[#E5C17A] flex items-center justify-center shrink-0 shadow-xs">
                  <GitBranch className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-display font-bold text-[#252321]">
                    عمود نسبي
                  </h2>
                  <p className="text-[11px] text-[#6E6456]">
                    سلسلة النسب التاريخية الموثقة والمصادر المرجعية
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-display font-bold text-[#8D4925] whitespace-nowrap">
                {result.matched ? 'ربط مرجعي موثق' : 'قيد التحقيق'}
              </span>
            </div>

            {/* Live Micro-Visual: Glowing Lineage Nodes Path */}
            <LineageGlowPathVisual
              familyName={result.familyName || 'العائلة'}
              rootLabel={verifiedRootDisplay}
              matched={result.matched}
              totalCapsules={totalCapsules}
              unlockedCapsulesCount={unlockedCapsulesCount}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5C5346]">
              <div>
                الجذر الموثق:{' '}
                <strong className="font-display text-[#252321]">
                  {verifiedRootDisplay}
                </strong>
              </div>
              <div className="tabular-nums">
                الحلقات الوسطية:{' '}
                <strong className="font-display text-[#8D4925]">
                  {unlockedCapsulesCount} مفتوحة من {totalCapsules}
                </strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab(DashboardTab.Lineage)}
            className="w-full py-2.5 px-4 rounded-xl bg-[#8D4925] hover:bg-[#733a1d] text-[#FAF4E4] text-xs font-display font-bold inline-flex items-center justify-between transition-all duration-300 cursor-pointer"
          >
            <span>استعراض عمود النسب الموثق</span>
            <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
          </button>
        </article>

        {/* 2. جناح «شجرتي» (Row 1 — 6 Columns, Calm Botanical Ivory & Tree Gauge) */}
        <article className="group lg:col-span-6 h-full rounded-2xl bg-gradient-to-bl from-[#FBFBF7] via-[#F4F6EE] to-[#EAEFE2] border border-[#C1CCB5]/75 p-5 sm:p-6 flex flex-col justify-between gap-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-[#8AA07C]">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2E4234] text-[#E5C17A] flex items-center justify-center shrink-0 shadow-xs">
                  <TreePine className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-display font-bold text-[#252321]">
                    شجرتي
                  </h2>
                  <p className="text-[11px] text-[#556150]">
                    استوديو المشجرة المعاصرة وتفريعات الأجيال
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-display font-bold text-[#2E4234] tabular-nums whitespace-nowrap">
                {treeMembersCount} فرداً
              </span>
            </div>

            {/* Live Micro-Visual: Mini Tree Branch SVG + Sleek Radial Gauge */}
            <TreeBranchGaugeVisual
              treeMembersCount={treeMembersCount}
              totalTreeCapacity={totalTreeCapacity}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#4C5847] tabular-nums">
              <span>
                الأفراد المسجلون:{' '}
                <strong className="font-display text-[#252321]">
                  {treeMembersCount} أفراد من سعة {totalTreeCapacity}
                </strong>
              </span>
              <span>
                السعة المتاحة:{' '}
                <strong className="font-display text-[#2E4234]">
                  {Math.max(0, totalTreeCapacity - treeMembersCount)} مقعداً
                </strong>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab(DashboardTab.MyTree)}
            className="w-full py-2.5 px-4 rounded-xl bg-[#2E4234] hover:bg-[#233428] text-[#F5F2E9] text-xs font-display font-bold inline-flex items-center justify-between transition-all duration-300 cursor-pointer"
          >
            <span>فتح استوديو الشجرة</span>
            <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
          </button>
        </article>

        {/* 3. حزمة «خزانتي» (Row 2 — 3 Columns on XL / 6 on LG, Stacked Polaroid Fan) */}
        <article className="group lg:col-span-6 xl:col-span-3 h-full rounded-2xl bg-[#FFFDF9] border border-[#DFD1BA] p-5 flex flex-col justify-between gap-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-[#C59B47]">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FAF3E6] border border-[#E0CEAE] text-[#8D4925] flex items-center justify-center shrink-0">
                  <FolderArchive className="w-4 h-4" />
                </div>
                <h2 className="text-base font-display font-bold text-[#252321]">
                  خزانتي
                </h2>
              </div>
              <span className="text-[11px] font-display font-bold text-[#8D4925] tabular-nums">
                {vaultState.itemsCount} مقتنى
              </span>
            </div>

            {/* Live Micro-Visual: Stacked Polaroid / Museum Album Fan */}
            <VaultPolaroidFanVisual
              previewPhotos={vaultState.previewPhotos}
              itemsCount={vaultState.itemsCount}
            />

            <div className="space-y-1 text-xs text-[#5C5346] tabular-nums">
              <div>
                الصور والوثائق:{' '}
                <strong className="text-[#252321]">
                  {vaultState.itemsCount} ملفاً
                </strong>
              </div>
              <div>
                مجلدات الأرشيف:{' '}
                <strong className="text-[#252321]">
                  {vaultState.foldersCount} مجلدات
                </strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab(DashboardTab.MyVault)}
            className="w-full py-2.5 px-3.5 rounded-xl bg-[#F7EFE0] hover:bg-[#8D4925] text-[#8D4925] hover:text-white border border-[#DEC9A4] hover:border-[#8D4925] text-xs font-display font-bold inline-flex items-center justify-between transition-all duration-300 cursor-pointer"
          >
            <span>إدارة الخزانة</span>
            <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-300 group-hover:-translate-x-1" />
          </button>
        </article>

        {/* 4. حزمة «موقعي» (Row 2 — 3 Columns on XL / 6 on LG, Live Mini Portal Mockup) */}
        <article className="group lg:col-span-6 xl:col-span-3 h-full rounded-2xl bg-[#FFFDF9] border border-[#DDD4C7] p-5 flex flex-col justify-between gap-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-[#8D6E48]">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#F5F2EC] border border-[#DDD4C7] text-[#252321] flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
                <h2 className="text-base font-display font-bold text-[#252321]">
                  موقعي
                </h2>
              </div>
              <span
                className={`text-[11px] font-display font-bold ${
                  siteInfo.isPublished ? 'text-emerald-800' : 'text-[#7A6F5F]'
                }`}
              >
                {siteInfo.isPublished ? 'منشور ✓' : 'مسودة'}
              </span>
            </div>

            {/* Live Micro-Visual: Authentic Snapshot of Client's Real Customized Site */}
            <SiteMiniBrowserVisual
              familyName={result.familyName || 'العائلة'}
              slug={siteInfo.slug}
              isPublished={siteInfo.isPublished}
              themeId={siteInfo.themeId}
              bioTitle={siteInfo.bioTitle}
              emblemTag={siteInfo.emblemTag}
              visualBranding={siteInfo.visualBranding}
            />

            <div className="space-y-1 text-xs text-[#5C5346]">
              <div className="truncate">
                الرابط:{' '}
                <strong
                  dir="ltr"
                  className="inline-block font-mono text-[11px] text-[#252321]"
                >
                  {siteInfo.slug
                    ? `${ACTIVE_PUBLIC_SITE_DISPLAY_HOST}/${siteInfo.slug}`
                    : 'لم يُحجز بعد'}
                </strong>
              </div>
              <div className="truncate">
                الحالة:{' '}
                <strong className="text-[#252321]">
                  {siteInfo.isPublished ? 'بوابة عائلية نشطة' : 'جاهز للتخصيص'}
                </strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab(DashboardTab.MySite)}
            className="w-full py-2.5 px-3.5 rounded-xl bg-[#F4F0E8] hover:bg-[#8D4925] text-[#252321] hover:text-white border border-[#D8CEBF] hover:border-[#8D4925] text-xs font-display font-bold inline-flex items-center justify-between transition-all duration-300 cursor-pointer"
          >
            <span>تخصيص موقعي</span>
            <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-300 group-hover:-translate-x-1" />
          </button>
        </article>

        {/* 5. حزمة «مجتمعي» (Row 2 — 3 Columns on XL / 6 on LG, Kinship Orbit & Avatars) */}
        <article className="group lg:col-span-6 xl:col-span-3 h-full rounded-2xl bg-[#FFFDF9] border border-[#E2CFC2] p-5 flex flex-col justify-between gap-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-[#D8755B]">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FDF1EC] border border-[#EBCBC0] text-[#D8755B] flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <h2 className="text-base font-display font-bold text-[#252321]">
                  مجتمعي
                </h2>
              </div>
              <span className="text-[11px] font-display font-bold text-[#8D4925] tabular-nums">
                {relativesCount} قريب
              </span>
            </div>

            {/* Live Micro-Visual: Kinship Orbit & Overlapping Avatars */}
            <KinshipOrbitVisual
              memberNames={circleMembers.map((m) => m.name)}
              relativesCount={relativesCount}
              pendingEnrichments={pendingEnrichments}
            />

            <div className="space-y-1 text-xs text-[#5C5346] tabular-nums">
              <div>
                أفراد الدائرة:{' '}
                <strong className="text-[#252321]">
                  {relativesCount} عضواً
                </strong>
              </div>
              <div>
                مقترحات الإثراء:{' '}
                <strong className="text-[#252321]">
                  {pendingEnrichments} بانتظار المراجعة
                </strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab(DashboardTab.MyCommunity)}
            className="w-full py-2.5 px-3.5 rounded-xl bg-[#FCF0EA] hover:bg-[#D8755B] text-[#8D4925] hover:text-white border border-[#E8C8B9] hover:border-[#D8755B] text-xs font-display font-bold inline-flex items-center justify-between transition-all duration-300 cursor-pointer"
          >
            <span>إدارة دائرة الأقارب</span>
            <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-300 group-hover:-translate-x-1" />
          </button>
        </article>

        {/* 6. حزمة «كشّافي ✦» (Row 2 — 3 Columns on XL / 6 on LG, Warm Parchment & Antique Gold Observatory Card) */}
        <article className="group lg:col-span-6 xl:col-span-3 h-full rounded-2xl bg-gradient-to-bl from-[#FFFDF9] via-[#FBF5E8] to-[#F4E7CE] border border-[#D6B97E]/80 text-[#252321] p-5 flex flex-col justify-between gap-4 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-[#B68A3A]">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FBF0D9] border border-[#DEC085] text-[#8D4925] flex items-center justify-center shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <h2 className="text-base font-display font-bold text-[#252321] tracking-wide">
                  كشّافي <span className="text-[#B88933]">✦</span>
                </h2>
              </div>
              {unreadKashafiItemsCount > 0 ? (
                <span className="text-[11px] font-display font-bold text-[#8D4925] tabular-nums">
                  {unreadKashafiItemsCount} جديد
                </span>
              ) : (
                <span className="text-[10px] font-bold text-[#8D4925]/85">
                  رادار البحوث
                </span>
              )}
            </div>

            {/* Live Micro-Visual: Warm Parchment & Antique Gold Radar */}
            <KashafiRadarVisual
              hasActiveTicket={Boolean(activeTicket)}
              discoveriesCount={kashafiItems.length}
              matchingCampaignsCount={matchingCampaignsCount}
            />

            <div className="space-y-1 text-xs text-[#5C5346]">
              <div className="truncate">
                التحقيق:{' '}
                <strong className="text-[#252321]">
                  {activeTicket
                    ? `بعثة جارية (#${activeTicket.ticketNumber})`
                    : 'لا توجد بعثة مفتوحة'}
                </strong>
              </div>
              <div className="tabular-nums truncate">
                المرصد:{' '}
                <strong className="text-[#8D4925]">
                  {kashafiItems.length} اكتشاف · {matchingCampaignsCount} خدمة
                </strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab(DashboardTab.MyExplorer)}
            className="w-full py-2.5 px-3.5 rounded-xl bg-[#F7E8C8] hover:bg-[#8D4925] text-[#7A3F1D] hover:text-white border border-[#D6B97E] hover:border-[#8D4925] text-xs font-display font-bold inline-flex items-center justify-between transition-all duration-300 cursor-pointer shadow-xs"
          >
            <span>استكشاف كشّافي</span>
            <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-300 group-hover:-translate-x-1" />
          </button>
        </article>
      </section>

      {/* ===================================================================
          TIER 3 — Luxury Glassmorphic Bottom Deck (Kashafi Pulse + Telegrams)
         =================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* Right Column: نبض كشّافي الجاري */}
        <div
          data-testid="home-kashafi-pulse-card"
          className="relative overflow-hidden h-full rounded-2xl bg-[#FFFDF9]/85 backdrop-blur-md border border-[#DAC8AA]/70 shadow-xs flex flex-col justify-between transition-all duration-300 hover:border-[#C59B47]/80"
        >
          {/* Fine gilded top hairline */}
          <div
            className="h-[2px] w-full bg-gradient-to-l from-[#D4AF6A] via-[#D8755B]/70 to-transparent"
            aria-hidden="true"
          />

          <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EDE4D4]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#FAF2E4] border border-[#DFCCA8] text-[#8D4925] flex items-center justify-center shrink-0">
                    <Scroll className="w-4 h-4" />
                  </div>
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
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <div className="text-sm font-display font-bold text-[#252321]">
                      {activeTicket.targetAncestor ||
                        `بعثة تحقيق نسب عائلة ${result.familyName}`}
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#6E6456]">
                      <span className="inline-flex items-center gap-1.5">
                        {resolveTicketLifecycleStage(activeTicket) ===
                        'NEEDS_INFO' ? (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
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

                  {/* Gilded Progress Track */}
                  <div className="h-2 rounded-full bg-[#EFE6D6] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-[#D4AF6A] to-[#D8755B] transition-all duration-500"
                      style={{ width: `${activeTicketProgress.percent}%` }}
                    />
                  </div>
                </div>
              ) : activeKashafiOrder ? (
                <div className="rounded-xl bg-[#FAF6EE]/80 border border-[#E6D9C3] p-4 space-y-1.5 text-xs">
                  <div className="text-sm font-display font-bold text-[#252321]">
                    {activeKashafiOrder.campaignTitle}
                  </div>
                  <p className="text-[#6E6456]">
                    الطلب{' '}
                    <span dir="ltr" className="font-mono font-bold text-[#252321]">
                      #{activeKashafiOrder.orderNumber}
                    </span>{' '}
                    — قيد المتابعة لدى{' '}
                    <strong className="text-[#8D4925]">
                      {activeKashafiOrder.assignedResearcherName || 'مدير البحوث'}
                    </strong>
                  </p>
                </div>
              ) : latestKashafiItem ? (
                <div className="rounded-xl bg-[#FAF6EE]/80 border border-[#E6D9C3] p-4 space-y-1.5 text-xs">
                  <div className="text-sm font-display font-bold text-[#252321]">
                    {latestKashafiItem.title}
                  </div>
                  <p className="text-[#6E6456] line-clamp-2 leading-relaxed">
                    {latestKashafiItem.summary}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[#6E6456] leading-relaxed py-2">
                  لا توجد بعثة تحقيق مفتوحة حالياً — يتابع مرصد البحوث سجلات عائلتكم ويعرض أي مستجدات أو بشارات مرجعية هنا تلقائياً.
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-[#EDE4D4] flex justify-end">
              <button
                type="button"
                onClick={() => onNavigateTab(DashboardTab.MyExplorer)}
                className="px-4 py-2 rounded-xl bg-[#FAF4E8] hover:bg-[#8D4925] text-[#8D4925] hover:text-white border border-[#DEC9A4] hover:border-[#8D4925] text-xs font-display font-bold inline-flex items-center gap-2 cursor-pointer transition-all duration-300"
              >
                <span>متابعة التفاصيل والمحادثة في كشّافي</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Left Column: برقيات وتنبيهات المنصة (Authenticated Telegram Cards) */}
        <div
          data-testid="home-latest-alerts-card"
          className="relative overflow-hidden h-full rounded-2xl bg-[#FFFDF9]/85 backdrop-blur-md border border-[#DAC8AA]/70 shadow-xs flex flex-col justify-between transition-all duration-300 hover:border-[#C59B47]/80"
        >
          {/* Fine gilded top hairline */}
          <div
            className="h-[2px] w-full bg-gradient-to-l from-[#C8A666] via-[#8D4925]/60 to-transparent"
            aria-hidden="true"
          />

          <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between gap-4">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EDE4D4]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#FAF2E4] border border-[#DFCCA8] text-[#8D4925] flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm sm:text-base font-display font-bold text-[#252321]">
                    برقيات وتنبيهات المنصة
                  </h2>
                </div>
                {dashboardNotifications.length > 0 && (
                  <span className="text-[11px] font-mono tabular-nums text-[#7A6F5F]">
                    {dashboardNotifications.length} برقية
                  </span>
                )}
              </div>

              {latestThreeAlerts.length === 0 ? (
                <p className="text-xs text-[#6E6456] leading-relaxed py-2">
                  لا توجد برقيات أو تنبيهات واردة في السجل حالياً.
                </p>
              ) : (
                <ul className="space-y-2">
                  {latestThreeAlerts.map((alert) => (
                    <li
                      key={alert.id}
                      onClick={onOpenNotificationsDrawer}
                      className="group/item rounded-xl px-3 py-2.5 bg-[#FAF6EE]/65 hover:bg-[#F5ECDC] border border-transparent hover:border-[#DECBA9] flex items-start justify-between gap-3 transition-all duration-300 cursor-pointer"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            alert.unread
                              ? 'bg-[#D8755B]/15 text-[#8D4925] border border-[#D8755B]/35'
                              : 'bg-white text-[#8C8272] border border-[#E2D6C3]'
                          }`}
                        >
                          {alert.unread ? (
                            <ShieldCheck className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="text-xs font-display font-bold text-[#252321] truncate group-hover/item:text-[#8D4925] transition-colors">
                            {alert.title}
                          </div>
                          <p className="text-[11px] text-[#6E6456] line-clamp-1">
                            {alert.body}
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] text-[#8C8272] whitespace-nowrap shrink-0 tabular-nums mt-0.5">
                        {alert.timestamp}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="pt-3 border-t border-[#EDE4D4] flex justify-end">
              <button
                type="button"
                onClick={onOpenNotificationsDrawer}
                className="px-4 py-2 rounded-xl bg-[#FAF4E8] hover:bg-[#252321] text-[#252321] hover:text-[#F3D299] border border-[#DEC9A4] hover:border-[#252321] text-xs font-display font-bold inline-flex items-center gap-2 cursor-pointer transition-all duration-300"
              >
                <span>عرض سجل البرقيات الكامل</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
