import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  FileSignature,
  FolderArchive,
  GitBranch,
  Globe,
  Inbox,
  Lock,
  MessageSquare,
  Scroll,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import {
  CustomerNotificationData,
  CustomerSiteSettingsData,
  ResearchTicketData,
  fetchUserFamilyTreeFromFirebase,
  fetchUserNotifications,
  fetchUserResearchTickets,
  fetchUserVaultArchive,
  markNotificationAsRead,
  readUserFamilyTreeFromLocal,
  readVaultArchiveFromLocal,
} from '../services/firestoreService';
import {
  SiteAccessRequestDoc,
  TreeEnrichmentRequestDoc,
  fetchKinshipCircleForOwner,
  fetchPendingSiteAccessRequestsForOwner,
  fetchUserReferralDashboard,
  resolveTicketLifecycleStage,
  subscribeToOwnerEnrichmentRequests,
} from '../services/priority4Service';
import {
  AccountLegalType,
  DashboardAccessCapabilities,
  DashboardTab,
  LineageSearchResult,
  NotificationItem,
} from '../types/juthori';
import { ResearchTicketsView } from './ResearchTicketsView';

interface CustomerHomeOverviewProps {
  result: LineageSearchResult;
  accountType: AccountLegalType;
  caps: DashboardAccessCapabilities;
  walletBalance: number;
  unlockedCapsules: string[];
  unlockedAddonSourceIds?: string[];
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
  onOpenFullResearchTickets: () => void;
  onTicketsStatusChange?: (status: {
    hasAnyTicket: boolean;
    hasResearcherReplyWaiting: boolean;
  }) => void;
}

export const CustomerHomeOverview: React.FC<CustomerHomeOverviewProps> = ({
  result,
  accountType,
  caps,
  walletBalance,
  unlockedCapsules,
  unlockedAddonSourceIds = [],
  userId = '',
  userEmail,
  userPhone = '',
  siteSettings,
  dashboardNotifications,
  onNavigateTab,
  onOpenWalletDrawer,
  onOpenNotificationsDrawer,
  onUnlockRoot5Usd,
  onUpgradeAnnualVip,
  onSignCharterAndEnableTree,
  onLogActivity,
  onAdoptResolvedLineage,
  onOpenFullResearchTickets,
  onTicketsStatusChange,
}) => {
  const isRecordKeeper = accountType === AccountLegalType.RecordKeeper;

  // 1. Live Tree Stats (Local cache first, then Firestore refresh)
  const [treeMembersCount, setTreeMembersCount] = useState<number>(() => {
    const localTree = readUserFamilyTreeFromLocal(
      userId,
      userEmail,
      result.familyName
    );
    return Array.isArray(localTree) ? localTree.length : 0;
  });

  // 2. Live Vault Stats
  const [vaultItemsCount, setVaultItemsCount] = useState<number>(() => {
    const localVault = readVaultArchiveFromLocal(
      userId,
      result.familyName,
      userEmail
    );
    return Array.isArray(localVault?.items) ? localVault.items.length : 0;
  });
  const [vaultFoldersCount, setVaultFoldersCount] = useState<number>(() => {
    const localVault = readVaultArchiveFromLocal(
      userId,
      result.familyName,
      userEmail
    );
    return Array.isArray(localVault?.folders) ? localVault.folders.length : 0;
  });

  // 3. Live Community & Microsite Stats
  const [kinshipMembersCount, setKinshipMembersCount] = useState<number>(0);
  const [pendingEnrichments, setPendingEnrichments] = useState<
    TreeEnrichmentRequestDoc[]
  >([]);
  const [pendingSiteAccessRequests, setPendingSiteAccessRequests] = useState<
    SiteAccessRequestDoc[]
  >([]);
  const [referralInviteesCount, setReferralInviteesCount] = useState<number>(0);
  const [referralEarnedUsd, setReferralEarnedUsd] = useState<number>(0);

  // 4. Live Cloud Notifications (Admin Announcements & Incoming Alerts) + Research Tickets Summary
  const [cloudNotifications, setCloudNotifications] = useState<
    CustomerNotificationData[]
  >([]);
  const [ticketsSummary, setTicketsSummary] = useState<ResearchTicketData[]>(
    []
  );

  useEffect(() => {
    let cancelled = false;

    if (userId || userEmail) {
      fetchUserFamilyTreeFromFirebase(userId, userEmail, result.familyName)
        .then((nodes) => {
          if (!cancelled && Array.isArray(nodes)) {
            setTreeMembersCount(nodes.length);
          }
        })
        .catch(() => {});

      fetchUserVaultArchive(userId, result.familyName, userEmail)
        .then((archive) => {
          if (!cancelled && archive) {
            if (Array.isArray(archive.items)) {
              setVaultItemsCount(archive.items.length);
            }
            if (Array.isArray(archive.folders)) {
              setVaultFoldersCount(archive.folders.length);
            }
          }
        })
        .catch(() => {});

      fetchUserResearchTickets(userId, userEmail)
        .then((list) => {
          if (!cancelled && Array.isArray(list)) {
            setTicketsSummary(list);
          }
        })
        .catch(() => {});
    }

    if (userId) {
      fetchKinshipCircleForOwner(userId)
        .then((circle) => {
          if (!cancelled && Array.isArray(circle?.members)) {
            setKinshipMembersCount(circle.members.length);
          }
        })
        .catch(() => {});

      fetchPendingSiteAccessRequestsForOwner(userId)
        .then((reqs) => {
          if (!cancelled && Array.isArray(reqs)) {
            setPendingSiteAccessRequests(reqs);
          }
        })
        .catch(() => {});

      fetchUserReferralDashboard(
        userId,
        `${result.clientName} ${result.familyName}`.trim()
      )
        .then((refData) => {
          if (!cancelled && refData) {
            setReferralInviteesCount(
              Array.isArray(refData.invitees) ? refData.invitees.length : 0
            );
            const rewardedCount = Array.isArray(refData.invitees)
              ? refData.invitees.filter((i) => i.status === 'REWARDED_10_USD')
                  .length
              : 0;
            setReferralEarnedUsd(
              rewardedCount * (refData.rewardPerAnnualSubUsd || 10)
            );
          }
        })
        .catch(() => {});

      fetchUserNotifications(userId)
        .then((notifs) => {
          if (!cancelled && Array.isArray(notifs)) {
            setCloudNotifications(notifs);
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [userId, userEmail, result.familyName, result.clientName]);

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToOwnerEnrichmentRequests(userId, (reqs) => {
      setPendingEnrichments(
        Array.isArray(reqs)
          ? reqs.filter((r) => r.status === 'PENDING_REGISTRAR_APPROVAL')
          : []
      );
    });
    return () => unsub();
  }, [userId]);

  const handleMarkCloudNotifRead = async (notifId: string) => {
    setCloudNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
    );
    if (userId) {
      await markNotificationAsRead(userId, notifId);
    }
  };

  // Compute Exact Lineage Spine Connection Status
  const lineageStatus = useMemo(() => {
    const ongoingTicket = ticketsSummary.find((t) => {
      const st = resolveTicketLifecycleStage(t);
      return st !== 'CLOSED' && !(st === 'RESOLVED' && t.resolutionPayload?.appliedByCustomerAt);
    });

    const isUpperMerged =
      !result.isAlphaOnlyBeforeMerge || Boolean(result.isAlphaMergedIntoAdam);

    if (result.matched && isUpperMerged && caps.areUpperAncestorsUnlocked) {
      return {
        tone: 'emerald' as const,
        badge: 'مربوط ومكتمل بشجرة آدم ✓',
        title: `عمود نسب عائلة (${result.familyName}) مربوط وموثق بالكامل حتى آدم عليه السلام`,
        description: `تم ربط وتوثيق الجذر (${result.rootBranchName} ← ${result.rootTribeName}) مع إتاحة الطبقات التاريخية العليا في شجرة آدم الجامعة.`,
        ctaLabel: 'استعراض عمود نسبي الكامل ←',
        onAction: () => onNavigateTab(DashboardTab.Lineage),
      };
    }

    if (
      result.matched &&
      !isUpperMerged &&
      (caps.isVip || caps.isRootUnlocked)
    ) {
      return {
        tone: 'amber' as const,
        badge: caps.isVip
          ? 'الجذر مفتوح · جاري ربط الطبقات العليا'
          : 'الجذر موثق · الطبقات العليا قيد الاستكمال',
        title: `الجذر الموثق لعائلة (${result.familyName}) مفتوح (${result.rootBranchName} ← ${result.rootTribeName})`,
        description: caps.isVip
          ? `باقتك السنوية مفعّلة، ويعمل فريق النسابين حالياً على المراجعة المرجعية لوصل (${result.rootTribeName}) بعمودها الأعلى في شجرة آدم حتى تظهر الطبقات العليا تلقائياً.`
          : `تم فتح الجذر التاريخي لعائلتك بنجاح. للربط الكامل مع الطبقات العليا في شجرة آدم ومتابعة التحقيق المرجعي، يمكنك الترقية إلى الباقة السنوية.`,
        ctaLabel: caps.isVip
          ? 'معاينة عمود نسبي الحالي ←'
          : 'الترقية للباقة السنوية لربط العمود الكامل ←',
        onAction: caps.isVip
          ? () => onNavigateTab(DashboardTab.Lineage)
          : onUpgradeAnnualVip,
      };
    }

    if (
      result.matched &&
      isUpperMerged &&
      caps.isRootUnlocked &&
      !caps.areUpperAncestorsUnlocked
    ) {
      return {
        tone: 'amber' as const,
        badge: 'الجذر مفتوح · الطبقات العليا مقفلة',
        title: `تم ربط جذر عائلة (${result.familyName}) بـ (${result.rootBranchName} ← ${result.rootTribeName})`,
        description:
          'جذر العائلة مفتوح على الباقة الأساسية، بينما بقية محطات العمود الأعلى في شجرة آدم متاحة للفتح عبر الاشتراك السنوي (بريميوم).',
        ctaLabel: 'فتح عمود نسبي أو الترقية لبريميوم ←',
        onAction: () => onNavigateTab(DashboardTab.Lineage),
      };
    }

    if (result.matched && !caps.isRootUnlocked && !caps.isVip) {
      return {
        tone: 'terracotta' as const,
        badge: 'تم رصد الجذر الموثق (بانتظار الفتح)',
        title: `تم رصد نقطة اتصال موثقة لعائلة (${result.familyName}) في أمهات المعاجم`,
        description:
          'نقطة اتصال عائلتك بعمودها التاريخي الموثق جاهزة للكشف الفوري ($5 لفتح الجذر أو $60 للباقة السنوية الشاملة).',
        ctaLabel: 'افتح جذر العائلة الموثق الآن ($5) ←',
        onAction: onUnlockRoot5Usd,
      };
    }

    if (!result.matched && (caps.isVip || ongoingTicket)) {
      return {
        tone: 'amber' as const,
        badge: 'قيد التحقيق النَّسبي في مرصد البحوث',
        title: `عمود نسب عائلة (${result.familyName}) قيد الفحص والربط المرجعي المتخصص`,
        description:
          'يتولى فريق الباحثين الجينيالوجيين فحص المخطوطات والمعاجم المعتمدة لربط عمود عائلتك وتوثيقه رسمياً. يمكنك متابعة التذكرة البحثية بالأسفل.',
        ctaLabel: 'معاينة حالة عمود نسبي ←',
        onAction: () => onNavigateTab(DashboardTab.Lineage),
      };
    }

    return {
      tone: 'neutral' as const,
      badge: 'غير مربوط آلياً بعد',
      title: `عمود نسب عائلة (${result.familyName}) يتطلب تحقيقاً أرشيفياً للربط الموثق`,
      description:
        'لم تظهر مطابقة آلية مباشرة في الفهرس الأولي. عند الاشتراك في الباقة السنوية يُحال طلبك تلقائياً إلى فريق الباحثين لتحقيق النسب وربطه بشجرة آدم.',
      ctaLabel: 'الترقية للباقة السنوية لطلب التحقيق ←',
      onAction: onUpgradeAnnualVip,
    };
  }, [
    result,
    caps,
    ticketsSummary,
    onNavigateTab,
    onUnlockRoot5Usd,
    onUpgradeAnnualVip,
  ]);

  // Platform Management Announcements (`feature_announcement` & `system_notice`) + Actionable Add-on Services
  const adminAnnouncements = useMemo(
    () =>
      cloudNotifications.filter(
        (n) =>
          n.category === 'feature_announcement' ||
          n.category === 'system_notice'
      ),
    [cloudNotifications]
  );

  const actionablePlatformServices = useMemo(() => {
    const items: Array<{
      id: string;
      badge: string;
      title: string;
      body: string;
      ctaLabel: string;
      onClick: () => void;
    }> = [];

    const totalCapsules = Array.isArray(result.capsules)
      ? result.capsules.length
      : 0;
    const lockedCapsulesCount = Math.max(
      0,
      totalCapsules - unlockedCapsules.length
    );

    if (result.matched && (caps.isRootUnlocked || caps.isVip) && lockedCapsulesCount > 0) {
      items.push({
        id: 'srv-capsules',
        badge: 'ميزة إضافية في عمود النسب',
        title: `إظهار حلقات الأجداد الوسيطين في السلسلة (${lockedCapsulesCount} حلقات متاحة)`,
        body: 'يمكنك كشف أسماء الأجداد الفرعيين والوسيطين بين المحطات الرئيسية في عمود نسبك لإكمال السلسلة التفصيلية.',
        ctaLabel: 'استعراض الحلقات في عمود نسبي',
        onClick: () => onNavigateTab(DashboardTab.Lineage),
      });
    }

    const unpurchasedAddons = (result.verifiedAddonSources || []).filter(
      (s) => !unlockedAddonSourceIds.includes(s.id || s.source_id)
    );
    if (unpurchasedAddons.length > 0) {
      items.push({
        id: 'srv-addons',
        badge: 'توثيق المصادر الإضافية',
        title: `تتوفر (${unpurchasedAddons.length}) مصادر ومخطوطات مساندة موثقة لعائلتك`,
        body: 'راجع شواهد المخطوطات الإضافية المعتمدة من أرشيف آدم وأضفها إلى بطاقة عمود نسبك الرسمية.',
        ctaLabel: 'معاينة المصادر الموثقة',
        onClick: () => onNavigateTab(DashboardTab.Lineage),
      });
    }

    if (!isRecordKeeper) {
      items.push({
        id: 'srv-charter',
        badge: 'خدمة متاحة للتفعيل المجاني',
        title: 'تفعيل صفة «رب أسرة / أمين السجل» وبناء مشجرة العائلة',
        body: 'وقّع ميثاق أمين السجل إلكترونياً لفتح بناء مشجرة عائلتك الخاصة، إدارة خزانة الوثائق، ونشر موقع العائلة الرسمي.',
        ctaLabel: 'توقيع الميثاق الإلكتروني الآن',
        onClick: onSignCharterAndEnableTree,
      });
    } else if (!siteSettings?.isPublished) {
      items.push({
        id: 'srv-microsite',
        badge: 'بوابة العائلة الرقمية',
        title: `إطلاق موقع عائلة (${result.familyName}) بـ 5 قوالب تراثية فاخرة`,
        body: 'أنشئ مرآة انتقائية محكومة بالخصوصية لمشجرتك وأرشيفك وشاركها مع أفراد عائلتك عبر رابط مخصص.',
        ctaLabel: 'إعداد ونشر موقعي',
        onClick: () => onNavigateTab(DashboardTab.MySite),
      });
    }

    items.push({
      id: 'srv-referral',
      badge: 'مكافآت المحفظة الرقمية ($10)',
      title: 'برنامج إثراء الدائرة القرابية ومكافآت الدعوة الفورية',
      body: 'ادعُ أقاربك للانضمام؛ تحصل تلقائياً على $10 في محفظتك الرقمية عن كل اشتراك سنوي يتم عبر رمز دعوتك الخاص.',
      ctaLabel: 'فتح مجتمعي ونسخ رمز الدعوة',
      onClick: () => onNavigateTab(DashboardTab.MyCommunity),
    });

    if (!caps.isVip) {
      items.unshift({
        id: 'srv-vip-upgrade',
        badge: 'باقة بريميوم السنوية',
        title: 'ترقية الحساب إلى الباقة السنوية الشاملة ($60/سنة)',
        body: 'افتح كامل محطات شجرة آدم العليا، خدمات التحقيق المرجعي في مرصد البحوث، ومزايا شجرتي وخزانتي وموقعي ومجتمعي.',
        ctaLabel: 'الترقية إلى بريميوم',
        onClick: onUpgradeAnnualVip,
      });
    }

    return items.slice(0, 4);
  }, [
    result.capsules,
    result.matched,
    result.familyName,
    result.verifiedAddonSources,
    unlockedCapsules.length,
    unlockedAddonSourceIds,
    caps.isRootUnlocked,
    caps.isVip,
    isRecordKeeper,
    siteSettings?.isPublished,
    onNavigateTab,
    onSignCharterAndEnableTree,
    onUpgradeAnnualVip,
  ]);

  // Incoming Messages & Actionable Alerts (Researcher replies, Enrichment requests, Site access requests, Ticket/Wallet notifications)
  const incomingMessagesAndAlerts = useMemo(() => {
    const list: Array<{
      id: string;
      senderBadge: string;
      title: string;
      body: string;
      timestamp: string;
      unread: boolean;
      ctaLabel: string;
      onClick: () => void;
    }> = [];

    // 1. Researcher replies on tickets
    for (const t of ticketsSummary) {
      const stage = resolveTicketLifecycleStage(t);
      const msgs = t.messages || [];
      const researcherMsgs = msgs.filter((m) => m.senderRole === 'researcher');
      const latestResearcherMsg = researcherMsgs[researcherMsgs.length - 1];

      if (latestResearcherMsg) {
        list.push({
          id: `tkt-msg-${latestResearcherMsg.id}`,
          senderBadge: 'رسالة من باحث المرصد',
          title: `${latestResearcherMsg.senderName} · التذكرة #${t.ticketNumber}`,
          body: latestResearcherMsg.body,
          timestamp: new Date(latestResearcherMsg.createdAt).toLocaleDateString(
            'ar-SA'
          ),
          unread:
            stage === 'NEEDS_INFO' ||
            msgs[msgs.length - 1]?.id === latestResearcherMsg.id,
          ctaLabel: 'الرد في التذكرة',
          onClick: () => {
            const el = document.querySelector(
              '[data-testid="home-active-research-ticket-box"]'
            );
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
              onOpenFullResearchTickets();
            }
          },
        });
      } else if (stage === 'NEEDS_INFO') {
        list.push({
          id: `tkt-needs-${t.id}`,
          senderBadge: 'مرصد البحوث',
          title: `بانتظار استكمال بيانات للتذكرة #${t.ticketNumber}`,
          body: 'يرجى تزويد الباحث المختص بالتوضيح أو المرفقات المطلوبة لاستئناف الفحص المرجعي.',
          timestamp: new Date(t.openedAt).toLocaleDateString('ar-SA'),
          unread: true,
          ctaLabel: 'استكمال البيانات',
          onClick: onOpenFullResearchTickets,
        });
      }
    }

    // 2. Pending Tree Enrichment Requests from Relatives
    for (const req of pendingEnrichments.slice(0, 3)) {
      const personLabel =
        req.proposedFirstName || req.targetPersonName || 'فرد في العائلة';
      list.push({
        id: `enr-${req.id}`,
        senderBadge: 'طلب إثراء قرابي',
        title: `اقتراح إضافة/تحديث من القريب: ${req.requesterName}`,
        body: `طلب إثراء وارد لفرع (${personLabel}) بانتظار مراجعتك واعتمادك في مشجرتك.`,
        timestamp: req.createdAt
          ? new Date(req.createdAt).toLocaleDateString('ar-SA')
          : 'جديد',
        unread: true,
        ctaLabel: 'مراجعة في مجتمعي',
        onClick: () => onNavigateTab(DashboardTab.MyCommunity),
      });
    }

    // 3. Pending Family Site Access Requests
    for (const acc of pendingSiteAccessRequests.slice(0, 2)) {
      list.push({
        id: `acc-${acc.id}`,
        senderBadge: 'استئذان دخول موقعي',
        title: `طلب صلاحية زيارة من: ${acc.visitorName}`,
        body: `يرغب في الاطلاع على بوابة عائلة (${result.familyName}) الخاصة.`,
        timestamp: acc.createdAt
          ? new Date(acc.createdAt).toLocaleDateString('ar-SA')
          : 'جديد',
        unread: true,
        ctaLabel: 'إدارة الطلب',
        onClick: () => onNavigateTab(DashboardTab.MyCommunity),
      });
    }

    // 4. Cloud Ticket / Wallet Notifications
    for (const cn of cloudNotifications.filter(
      (n) => n.category === 'ticket_update' || n.category === 'wallet_bonus'
    )) {
      list.push({
        id: cn.id,
        senderBadge:
          cn.category === 'wallet_bonus' ? 'المحفظة الرقمية' : 'تحديث الحساب',
        title: cn.title,
        body: cn.body,
        timestamp: cn.createdAt
          ? new Date(cn.createdAt).toLocaleDateString('ar-SA')
          : 'اليوم',
        unread: !cn.isRead,
        ctaLabel:
          cn.category === 'wallet_bonus' ? 'عرض المحفظة' : 'فتح التفاصيل',
        onClick: () => {
          handleMarkCloudNotifRead(cn.id);
          if (cn.category === 'wallet_bonus') {
            onOpenWalletDrawer();
          } else {
            onOpenFullResearchTickets();
          }
        },
      });
    }

    // 5. Fallback to system notifications if list is empty
    if (list.length === 0) {
      for (const dn of dashboardNotifications.slice(0, 2)) {
        list.push({
          id: dn.id,
          senderBadge: 'إشعار المنصة',
          title: dn.title,
          body: dn.body,
          timestamp: dn.timestamp,
          unread: dn.unread,
          ctaLabel:
            dn.actionType === 'unlock_5'
              ? 'فتح الجذر ($5)'
              : dn.actionType === 'upgrade_vip'
              ? 'ترقية الباقة'
              : 'عرض الإشعارات',
          onClick: () => {
            if (dn.actionType === 'unlock_5') onUnlockRoot5Usd();
            else if (dn.actionType === 'upgrade_vip') onUpgradeAnnualVip();
            else onOpenNotificationsDrawer();
          },
        });
      }
    }

    return list;
  }, [
    ticketsSummary,
    pendingEnrichments,
    pendingSiteAccessRequests,
    cloudNotifications,
    dashboardNotifications,
    result.familyName,
    onNavigateTab,
    onOpenFullResearchTickets,
    onOpenWalletDrawer,
    onUnlockRoot5Usd,
    onUpgradeAnnualVip,
    onOpenNotificationsDrawer,
  ]);

  const unreadMessagesTotal =
    incomingMessagesAndAlerts.filter((m) => m.unread).length +
    adminAnnouncements.filter((a) => !a.isRead).length;

  const treeCapacityLabel = isRecordKeeper
    ? caps.maxTreeMembers
      ? `${treeMembersCount} / ${caps.maxTreeMembers} فرداً`
      : `${treeMembersCount} فرداً (سعة مفتوحة)`
    : `${treeMembersCount} / 250 فرداً`;

  return (
    <div
      data-testid="customer-home-welcome-overview"
      className="space-y-6 text-[#252321]"
    >
      {/* 1. WELCOME HERO & WALLET SUMMARY STRIP */}
      <section className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 sm:p-7 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FAF6F0] border border-[#B98A78]/45 text-xs font-display font-bold text-[#8D4925]">
                <Crown className="w-3.5 h-3.5 text-[#D8755B]" />
                <span>
                  {caps.isVip
                    ? 'عضوية بريميوم السنوية مفعّلة'
                    : caps.isRootUnlocked
                    ? 'الباقة الأساسية · الجذر الموثق'
                    : 'العضوية التأسيسية'}
                </span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#F7F2E9] border border-[#B98A78]/35 text-xs font-display font-bold text-[#252321]">
                <FileSignature className="w-3.5 h-3.5 text-[#8D4925]" />
                <span>
                  {isRecordKeeper
                    ? 'الصفة القانونية: رب أسرة / أمين السجل ✓'
                    : 'الصفة القانونية: حساب فرد'}
                </span>
              </span>

              {unreadMessagesTotal > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-xs font-display font-bold text-amber-950 tabular-nums">
                  <Bell className="w-3.5 h-3.5 text-amber-700" />
                  <span>{unreadMessagesTotal} تنبيهات أو رسائل جديدة</span>
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-display font-extrabold text-[#252321]">
              مرحباً بك يا {result.clientName || 'عميلنا الكريم'} في لوحة سجل عائلة ({result.familyName})
            </h1>
            <p className="text-xs sm:text-sm text-[#252321]/75 max-w-3xl leading-relaxed">
              ملخصك الشامل لمتابعة حالة ربط عمود النسب، إحصائيات مشجرتك وخزانة وثائقك ودائرتك القرابية، رصيد المحفظة الرقمية، وأحدث رسائل الباحثين وإشعارات المنصة.
            </p>
          </div>

          {/* Wallet Balance & Quick Top-Up Card */}
          <div className="rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/45 p-4 sm:p-5 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center justify-between gap-4 shrink-0 min-w-[270px]">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#252321] text-[#F3D299] flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-display font-bold text-[#8D4925]">
                  رصيد المحفظة الرقمية
                </div>
                <div
                  data-testid="home-wallet-balance"
                  className="text-xl font-mono font-extrabold text-[#252321] tabular-nums"
                  dir="ltr"
                >
                  ${walletBalance.toFixed(2)}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenWalletDrawer}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>المحفظة والاشتراكات</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. LINEAGE SPINE CONNECTION STATUS CARD */}
      <section
        data-testid="home-lineage-connection-status"
        className={`rounded-2xl border p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 ${
          lineageStatus.tone === 'emerald'
            ? 'bg-[#FFFDF9] border-emerald-500/60'
            : lineageStatus.tone === 'amber'
            ? 'bg-[#FFFDF9] border-[#D4AF37]/80'
            : lineageStatus.tone === 'terracotta'
            ? 'bg-white border-[#D8755B]/60'
            : 'bg-white border-[#B98A78]/45'
        }`}
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-display font-bold text-[#8D4925]">
              حالة عمود النسب:
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-display font-bold border ${
                lineageStatus.tone === 'emerald'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : lineageStatus.tone === 'amber'
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : lineageStatus.tone === 'terracotta'
                  ? 'bg-[#D8755B]/15 border-[#D8755B]/40 text-[#8D4925]'
                  : 'bg-[#F7F2E9] border-[#B98A78]/40 text-[#252321]'
              }`}
            >
              {lineageStatus.tone === 'emerald' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              ) : lineageStatus.tone === 'amber' ? (
                <Clock className="w-3.5 h-3.5 text-amber-700" />
              ) : lineageStatus.tone === 'terracotta' ? (
                <Lock className="w-3.5 h-3.5 text-[#D8755B]" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-[#8D4925]" />
              )}
              <span>{lineageStatus.badge}</span>
            </span>

            {result.matched && (caps.isRootUnlocked || caps.isVip) && (
              <span className="text-xs font-semibold text-[#8D4925] bg-[#FAF6F0] px-2.5 py-1 rounded-lg border border-[#B98A78]/35">
                الفرع الجامع: <strong>{result.rootBranchName}</strong> · القبيلة الأم:{' '}
                <strong>{result.rootTribeName}</strong>
              </span>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-display font-extrabold text-[#252321]">
            {lineageStatus.title}
          </h2>
          <p className="text-xs sm:text-sm text-[#252321]/75 max-w-3xl leading-relaxed">
            {lineageStatus.description}
          </p>
        </div>

        <button
          type="button"
          onClick={lineageStatus.onAction}
          className="px-5 py-3 rounded-xl bg-[#252321] hover:bg-[#3a3633] text-[#F3D299] text-xs sm:text-sm font-display font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
        >
          <span>{lineageStatus.ctaLabel}</span>
        </button>
      </section>

      {/* 3. WORKSPACE LIVE STATISTICS GRID (شجرتي · خزانتي · مجتمعي · موقعي) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Stat 1: شجرتي */}
        <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-display font-bold text-[#8D4925]">
                إحصائيات شجرتي
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] border border-[#B98A78]/35 text-[#8D4925] flex items-center justify-center">
                <GitBranch className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-mono font-extrabold text-[#252321] tabular-nums">
              {treeMembersCount}{' '}
              <span className="text-xs font-display font-bold text-[#252321]/70">
                فرداً مسجلاً
              </span>
            </div>
            <p className="text-xs text-[#252321]/70">
              السعة الحالية: <strong className="tabular-nums">{treeCapacityLabel}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              onLogActivity('التنقل من الرئيسية', 'فتح تبويب شجرتي');
              onNavigateTab(DashboardTab.MyTree);
            }}
            className="w-full py-2 px-3 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#B98A78]/35 text-xs font-display font-bold text-[#252321] inline-flex items-center justify-between cursor-pointer transition-colors"
          >
            <span>إدارة مشجرة العائلة</span>
            <ArrowLeft className="w-3.5 h-3.5 text-[#D8755B]" />
          </button>
        </div>

        {/* Stat 2: خزانتي */}
        <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-display font-bold text-[#8D4925]">
                إحصائيات خزانتي
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] border border-[#B98A78]/35 text-[#D8755B] flex items-center justify-center">
                <FolderArchive className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-mono font-extrabold text-[#252321] tabular-nums">
              {vaultItemsCount}{' '}
              <span className="text-xs font-display font-bold text-[#252321]/70">
                وثيقة وصورة
              </span>
            </div>
            <p className="text-xs text-[#252321]/70">
              منظمة ضمن{' '}
              <strong className="tabular-nums">{vaultFoldersCount || 4}</strong> مجلدات أرشيفية خاصة
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              onLogActivity('التنقل من الرئيسية', 'فتح تبويب خزانتي');
              onNavigateTab(DashboardTab.MyVault);
            }}
            className="w-full py-2 px-3 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#B98A78]/35 text-xs font-display font-bold text-[#252321] inline-flex items-center justify-between cursor-pointer transition-colors"
          >
            <span>فتح خزانة الوثائق</span>
            <ArrowLeft className="w-3.5 h-3.5 text-[#D8755B]" />
          </button>
        </div>

        {/* Stat 3: مجتمعي */}
        <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-display font-bold text-[#8D4925]">
                إحصائيات مجتمعي
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] border border-[#B98A78]/35 text-[#8D4925] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-mono font-extrabold text-[#252321] tabular-nums">
              {kinshipMembersCount}{' '}
              <span className="text-xs font-display font-bold text-[#252321]/70">
                أقارب بالدائرة
              </span>
            </div>
            <p className="text-xs text-[#252321]/70 tabular-nums">
              طلبات إثراء معلقة: <strong>{pendingEnrichments.length}</strong> · مكافآت الدعوة:{' '}
              <strong dir="ltr">${referralEarnedUsd}</strong> ({referralInviteesCount})
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              onLogActivity('التنقل من الرئيسية', 'فتح تبويب مجتمعي');
              onNavigateTab(DashboardTab.MyCommunity);
            }}
            className="w-full py-2 px-3 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#B98A78]/35 text-xs font-display font-bold text-[#252321] inline-flex items-center justify-between cursor-pointer transition-colors"
          >
            <span>فتح الدائرة القرابية</span>
            <ArrowLeft className="w-3.5 h-3.5 text-[#D8755B]" />
          </button>
        </div>

        {/* Stat 4: موقعي */}
        <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-display font-bold text-[#8D4925]">
                بوابة موقعي العائلي
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] border border-[#B98A78]/35 text-[#D8755B] flex items-center justify-center">
                <Globe className="w-4 h-4" />
              </div>
            </div>
            <div className="text-base font-display font-extrabold text-[#252321] pt-1">
              {siteSettings?.isPublished ? (
                <span className="text-emerald-800">منشور ومفعّل للأقارب ✓</span>
              ) : (
                <span className="text-[#8D4925]">مسودة خاصة (غير منشور)</span>
              )}
            </div>
            <p className="text-xs text-[#252321]/70 tabular-nums">
              {siteSettings?.siteSubdomain
                ? `الرابط: /family/${siteSettings.siteSubdomain}`
                : 'اختر من 5 قوالب تراثية معزولة'}{' '}
              {pendingSiteAccessRequests.length > 0 &&
                `· (${pendingSiteAccessRequests.length} طلب دخول)`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              onLogActivity('التنقل من الرئيسية', 'فتح تبويب موقعي');
              onNavigateTab(DashboardTab.MySite);
            }}
            className="w-full py-2 px-3 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#B98A78]/35 text-xs font-display font-bold text-[#252321] inline-flex items-center justify-between cursor-pointer transition-colors"
          >
            <span>إدارة بوابة موقعي</span>
            <ArrowLeft className="w-3.5 h-3.5 text-[#D8755B]" />
          </button>
        </div>
      </section>

      {/* 4. INDEPENDENT ACTIVE RESEARCH TICKET BOX (EXACT OBSERVATORY FORMAT WHEN WORK IS ONGOING) */}
      <ResearchTicketsView
        embeddedHomeWidget
        result={result}
        accountType={accountType}
        userEmail={userEmail}
        userId={userId}
        userPhone={userPhone}
        isVip={caps.isVip}
        onRequestUpgradeVip={onUpgradeAnnualVip}
        onLogActivity={onLogActivity}
        onOpenFullTicketsPage={onOpenFullResearchTickets}
        onTicketsStatusChange={onTicketsStatusChange}
        onAdoptResolvedLineage={onAdoptResolvedLineage}
      />

      {/* 5. PLATFORM ANNOUNCEMENTS / NEW SERVICES & INCOMING MESSAGES */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Highlighted Platform Management Announcements & Add-on Services (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-white border border-[#B98A78]/40 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#B98A78]/25">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FEF3C7] border border-[#D4AF37] text-[#8D4925] flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-[#D97706]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-display font-extrabold text-[#252321]">
                  إشعارات إدارة المنصة والخدمات والمزايا المتاحة للإضافة
                </h3>
                <p className="text-[11px] text-[#252321]/65">
                  تنبيهات الإدارة الرسمية حول التحديثات والمزايا التي يمكنك إضافتها لسجل عائلتك
                </p>
              </div>
            </div>
          </div>

          {/* Official Admin Broadcasts from Firestore (`feature_announcement` / `system_notice`) */}
          {adminAnnouncements.length > 0 && (
            <div className="space-y-2.5">
              {adminAnnouncements.map((ann) => (
                <div
                  key={ann.id}
                  className="rounded-xl bg-[#FFFDF9] border-2 border-[#D4AF37]/80 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#8D4925] text-[#FEF3C7] text-[10px] font-display font-bold">
                      <ShieldCheck className="w-3 h-3" />
                      <span>إشعار رسمي من إدارة المنصة</span>
                    </span>
                    <span className="text-[11px] text-[#252321]/55 tabular-nums">
                      {ann.createdAt
                        ? new Date(ann.createdAt).toLocaleDateString('ar-SA')
                        : 'جديد'}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm font-display font-extrabold text-[#252321]">
                    {ann.title}
                  </div>
                  <p className="text-xs text-[#252321]/80 leading-relaxed">
                    {ann.body}
                  </p>
                  {!ann.isRead && (
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleMarkCloudNotifRead(ann.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#B98A78]/40 text-[11px] font-display font-bold text-[#8D4925] cursor-pointer"
                      >
                        تأكيد الاطلاع ✓
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Curated Actionable Platform Services & Features */}
          <div className="space-y-2.5">
            {actionablePlatformServices.map((srv) => (
              <div
                key={srv.id}
                className="rounded-xl bg-[#FAF6F0] border border-[#B98A78]/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <span className="inline-block text-[10px] font-display font-bold text-[#D8755B]">
                    ✦ {srv.badge}
                  </span>
                  <div className="text-xs sm:text-sm font-display font-bold text-[#252321]">
                    {srv.title}
                  </div>
                  <p className="text-xs text-[#252321]/75 leading-relaxed">
                    {srv.body}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={srv.onClick}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#252321] hover:text-[#F3D299] border border-[#B98A78]/50 text-xs font-display font-bold text-[#252321] transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                >
                  {srv.ctaLabel} ←
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Incoming Messages & Alerts Inbox (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-[#B98A78]/40 p-5 sm:p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#B98A78]/25">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] border border-[#B98A78]/35 text-[#D8755B] flex items-center justify-center shrink-0">
                  <Inbox className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-display font-extrabold text-[#252321]">
                    الرسائل والتنبيهات الواردة
                  </h3>
                  <p className="text-[11px] text-[#252321]/65">
                    مراسلات الباحثين، طلبات الإثراء القرابية، وإشعارات الحساب
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenNotificationsDrawer}
                className="text-xs font-display font-bold text-[#8D4925] hover:text-[#D8755B] cursor-pointer whitespace-nowrap"
              >
                عرض السجل الكامل
              </button>
            </div>

            {incomingMessagesAndAlerts.length === 0 ? (
              <div className="rounded-xl bg-[#FAF6F0] border border-[#B98A78]/30 p-6 text-center space-y-2">
                <MessageSquare className="w-6 h-6 text-[#8D4925]/60 mx-auto" />
                <div className="text-xs font-display font-bold text-[#252321]">
                  صندوق الرسائل الواردة محدّث بالكامل
                </div>
                <p className="text-[11px] text-[#252321]/65">
                  ستظهر هنا فوراً أي ردود جديدة من فريق الباحثين أو طلبات إثراء واردة من أقاربك.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {incomingMessagesAndAlerts.slice(0, 5).map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-xl p-3.5 border space-y-1.5 ${
                      msg.unread
                        ? 'bg-[#FFFDF9] border-[#D8755B]/55'
                        : 'bg-[#FAF6F0]/70 border-[#B98A78]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-display font-bold px-2 py-0.5 rounded bg-[#EDE6DA] text-[#8D4925]">
                        {msg.senderBadge}
                      </span>
                      <span className="text-[10px] text-[#252321]/55 tabular-nums">
                        {msg.timestamp}
                      </span>
                    </div>
                    <div className="text-xs font-display font-bold text-[#252321]">
                      {msg.title}
                    </div>
                    <p className="text-xs text-[#252321]/75 line-clamp-2 leading-relaxed">
                      {msg.body}
                    </p>
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={msg.onClick}
                        className="text-[11px] font-display font-bold text-[#D8755B] hover:text-[#8D4925] cursor-pointer"
                      >
                        {msg.ctaLabel} ←
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shortcut to Full Research Observatory Archive (accessible via Profile Menu too) */}
          <div className="pt-3 border-t border-[#B98A78]/25 flex items-center justify-between gap-2 text-xs">
            <span className="text-[#252321]/65 flex items-center gap-1.5">
              <Scroll className="w-3.5 h-3.5 text-[#8D4925]" />
              <span>سجل تذاكر مرصد البحوث متاح أيضاً في قائمة حسابك</span>
            </span>
            <button
              type="button"
              onClick={onOpenFullResearchTickets}
              className="font-display font-bold text-[#8D4925] hover:text-[#D8755B] cursor-pointer whitespace-nowrap"
            >
              أرشيف التذاكر ←
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
