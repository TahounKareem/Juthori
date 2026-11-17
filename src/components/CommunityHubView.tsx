import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Check,
  CheckCircle2,
  Copy,
  DollarSign,
  ExternalLink,
  FileSignature,
  GitMerge,
  Globe,
  Inbox,
  Loader2,
  Mail,
  Send,
  Share2,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import {
  AccountLegalType,
  DashboardAccessCapabilities,
  DashboardTab,
  LineageSearchResult,
} from '../types/juthori';
import {
  REFERRAL_REWARD_USD,
  buildDeterministicReferralCode,
} from '../config/referralAndSiteConfig';
import {
  KinshipCircleDoc,
  SiteAccessRequestDoc,
  TreeEnrichmentRequestDoc,
  addRelativeToKinshipCircleAndSendInvite,
  fetchAuthorizedFamilyPortalsForEmail,
  fetchKinshipCircleForOwner,
  fetchPendingSiteAccessRequestsForOwner,
  fetchUserReferralDashboard,
  normalizePublicSiteSlug,
  removeRelativeFromKinshipCircle,
  resolveSiteAccessRequest,
  reviewAndMergeEnrichmentRequest,
  subscribeToOwnerEnrichmentRequests,
} from '../services/priority4Service';

interface CommunityHubViewProps {
  result: LineageSearchResult;
  accountType: AccountLegalType;
  caps: DashboardAccessCapabilities;
  userId?: string;
  userEmail?: string;
  publishedSiteSlug?: string;
  blockedUserIds?: string[];
  onBlockUser?: (targetUserId: string, targetUserName: string) => void;
  onNavigateTab?: (tab: DashboardTab) => void;
  onSignCharterAndEnableTree?: () => void;
  onLogActivity: (action: string, detail: string) => void;
}

type KinshipHubTab = 'kinship_circle' | 'enrichment_inbox' | 'referral_rewards';

export const CommunityHubView: React.FC<CommunityHubViewProps> = ({
  result,
  accountType,
  caps,
  userId,
  userEmail,
  publishedSiteSlug,
  onNavigateTab,
  onSignCharterAndEnableTree,
  onLogActivity,
}) => {
  const [activePillar, setActivePillar] =
    useState<KinshipHubTab>('kinship_circle');

  const effectiveSiteSlug = useMemo(() => {
    if (publishedSiteSlug) return normalizePublicSiteSlug(publishedSiteSlug);
    return '';
  }, [publishedSiteSlug]);

  const ownerFullName = `${result.clientName} ${result.familyName}`.trim();
  const referralCode = useMemo(
    () => buildDeterministicReferralCode(userId || 'usr_guest'),
    [userId]
  );

  // Pillar 1: Kinship Circle & Authorized Portals
  const [circle, setCircle] = useState<KinshipCircleDoc>({
    ownerId: userId || '',
    members: [],
    updatedAt: '',
  });
  const [relName, setRelName] = useState('');
  const [relKinship, setRelKinship] = useState('ابن عم');
  const [relEmail, setRelEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [circleBanner, setCircleBanner] = useState<string | null>(null);

  const [authorizedPortals, setAuthorizedPortals] = useState<
    Array<{
      siteSlug: string;
      familyName: string;
      ownerDisplayName: string;
    }>
  >([]);
  const [accessRequests, setAccessRequests] = useState<SiteAccessRequestDoc[]>(
    []
  );

  // Pillar 2: Incoming Enrichment Requests Inbox
  const [enrichmentRequests, setEnrichmentRequests] = useState<
    TreeEnrichmentRequestDoc[]
  >([]);
  const [processingReqId, setProcessingReqId] = useState<string | null>(null);
  const [enrichmentBanner, setEnrichmentBanner] = useState<string | null>(null);

  // Pillar 3: $10 Referral Engine Dashboard
  const [referralStats, setReferralStats] = useState<{
    referralCode: string;
    rewardPerAnnualSubUsd: number;
    invitees: Array<{
      userId: string;
      fullName: string;
      status: 'REGISTERED_FREE' | 'REWARDED_10_USD';
      createdAt: string;
      rewardedAt?: string;
    }>;
    registeredCount: number;
    rewardedAnnualCount: number;
    totalEarnedUsd: number;
  }>({
    referralCode,
    rewardPerAnnualSubUsd: REFERRAL_REWARD_USD,
    invitees: [],
    registeredCount: 0,
    rewardedAnnualCount: 0,
    totalEarnedUsd: 0,
  });
  const [copiedInviteUrl, setCopiedInviteUrl] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (userId) {
      fetchKinshipCircleForOwner(userId).then((res) => {
        if (mounted) setCircle(res);
      });
      fetchPendingSiteAccessRequestsForOwner(userId).then((reqs) => {
        if (mounted) setAccessRequests(reqs);
      });
      fetchUserReferralDashboard(userId, ownerFullName).then((stats) => {
        if (mounted) setReferralStats(stats);
      });
    }
    if (userEmail) {
      fetchAuthorizedFamilyPortalsForEmail(userEmail).then((portals) => {
        if (mounted) setAuthorizedPortals(portals);
      });
    }
    return () => {
      mounted = false;
    };
  }, [userId, userEmail, ownerFullName]);

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToOwnerEnrichmentRequests(userId, (list) => {
      setEnrichmentRequests(list);
    });
    return () => unsub();
  }, [userId]);

  const pendingEnrichmentsCount = useMemo(
    () =>
      enrichmentRequests.filter(
        (r) => r.status === 'PENDING_REGISTRAR_APPROVAL'
      ).length,
    [enrichmentRequests]
  );

  const guardiansLeaderboard = useMemo(() => {
    return [...(circle.members || [])]
      .filter((m) => (m.approvedEnrichmentsCount || 0) > 0)
      .sort(
        (a, b) =>
          (b.approvedEnrichmentsCount || 0) - (a.approvedEnrichmentsCount || 0)
      )
      .slice(0, 5);
  }, [circle.members]);

  const personalInviteLink = useMemo(() => {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://juthori.com';
    if (effectiveSiteSlug) {
      return `${origin}/${effectiveSiteSlug}?ref=${encodeURIComponent(
        referralStats.referralCode || referralCode
      )}`;
    }
    return `${origin}/?ref=${encodeURIComponent(
      referralStats.referralCode || referralCode
    )}`;
  }, [effectiveSiteSlug, referralStats.referralCode, referralCode]);

  const handleAddRelativeAndSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !relName.trim() || !relEmail.trim()) return;
    setInviting(true);
    setCircleBanner(null);
    try {
      const res = await addRelativeToKinshipCircleAndSendInvite({
        ownerId: userId,
        ownerName: ownerFullName,
        familyName: result.familyName,
        siteSlug: effectiveSiteSlug || circle.siteSlug,
        referralCode: referralStats.referralCode || referralCode,
        relativeName: relName,
        kinshipRelation: relKinship,
        relativeEmail: relEmail,
      });
      setCircle(res.circle);
      setCircleBanner(res.messageAr);
      setRelName('');
      setRelEmail('');
      onLogActivity('دعوة قريب لدائرة عائلتي', res.messageAr);
    } finally {
      setInviting(false);
    }
  };

  const handleCopyInviteUrl = async () => {
    try {
      await navigator.clipboard.writeText(personalInviteLink);
      setCopiedInviteUrl(true);
      setTimeout(() => setCopiedInviteUrl(false), 2200);
    } catch {
      // Ignore
    }
  };

  const handleApproveOrRejectEnrichment = async (
    req: TreeEnrichmentRequestDoc,
    approve: boolean
  ) => {
    if (!userId) return;
    setProcessingReqId(req.id);
    setEnrichmentBanner(null);
    try {
      const outcome = await reviewAndMergeEnrichmentRequest({
        request: req,
        approve,
        ownerId: userId,
        ownerEmail: userEmail,
        familyName: result.familyName,
      });
      setEnrichmentBanner(outcome.messageAr);
      const refreshedCircle = await fetchKinshipCircleForOwner(userId);
      setCircle(refreshedCircle);
      onLogActivity(
        approve ? 'اعتماد ودمج إثراء عائلي' : 'رفض مقترح إثراء',
        outcome.messageAr
      );
    } finally {
      setProcessingReqId(null);
    }
  };

  const whatsappReferralHref = `https://wa.me/?text=${encodeURIComponent(
    `أدعوك لاستكشاف سجل وبوابة أسرة (${result.familyName}) الموثقة وفحص عمود نسبك عبر منصة جذوري:\n${personalInviteLink}`
  )}`;

  const telegramReferralHref = `https://t.me/share/url?url=${encodeURIComponent(
    personalInviteLink
  )}&text=${encodeURIComponent(
    `أدعوك لزيارة بوابة أسرة (${result.familyName}) وفحص عمود نسبك عبر منصة جذوري`
  )}`;

  return (
    <div className="space-y-6">
      {/* Header & 3 Pure Pillars Navigation (Zero Public Feed) */}
      <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 sm:p-7 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#B98A78]/25 pb-5">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#D8755B] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>مجتمعي · الدائرة العائلية الخاصة والإثراء التعاوني المحكوم</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-[#252321]">
              دائرة أسرة {result.familyName} وصلة الرحم الموثقة
            </h2>
            <p className="text-xs text-[#252321]/70 max-w-2xl leading-relaxed">
              مساحة خاصة ومعزولة بالكامل لإدارة أقاربك المصرّح لهم بدخول موقعك العائلي، مراجعة مقترحات الإثراء ودمجها في سجلاتك بضغطة زر، وتتبع مكافآت الدعوة (${REFERRAL_REWARD_USD}).
            </p>
          </div>

          {/* Quick Share Invite Pill-free Bar */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyInviteUrl}
              className="px-4 py-2.5 rounded-xl bg-[#F7F2E9] hover:bg-[#EDE6DA] border border-[#B98A78]/50 text-[#252321] text-xs font-display font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              {copiedInviteUrl ? (
                <>
                  <Check className="w-4 h-4 text-emerald-700" />
                  <span>تم نسخ رابط الدعوة</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#8D4925]" />
                  <span>نسخ رابط دعوة الأقارب</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setActivePillar('kinship_circle')}
            className={`p-4 rounded-xl border text-right space-y-1 transition-colors cursor-pointer ${
              activePillar === 'kinship_circle'
                ? 'bg-[#252321] text-[#F7F2E9] border-[#252321]'
                : 'bg-[#F7F2E9]/70 text-[#252321] border-[#B98A78]/35 hover:bg-[#EDE6DA]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-display font-bold flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#D8755B]" />
                <span>1. دائرة عائلتي والبوابات المصرّحة</span>
              </span>
              <span className="text-xs font-mono opacity-80">
                {circle.members.length}
              </span>
            </div>
            <p className="text-[11px] opacity-75">
              دعوة الأقارب عبر البريد مع خيار إلغاء الارتباط الفوري (Opt-out)
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActivePillar('enrichment_inbox')}
            className={`p-4 rounded-xl border text-right space-y-1 transition-colors cursor-pointer ${
              activePillar === 'enrichment_inbox'
                ? 'bg-[#252321] text-[#F7F2E9] border-[#252321]'
                : 'bg-[#F7F2E9]/70 text-[#252321] border-[#B98A78]/35 hover:bg-[#EDE6DA]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-display font-bold flex items-center gap-1.5">
                <Inbox className="w-4 h-4 text-[#D8755B]" />
                <span>2. صندوق طلبات الإثراء الواردة</span>
              </span>
              {pendingEnrichmentsCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-[#D8755B] text-white text-[11px] font-bold">
                  {pendingEnrichmentsCount} جديد
                </span>
              )}
            </div>
            <p className="text-[11px] opacity-75">
              اعتماد ودمج المواليد والفروع والصور في شجرتك وخزانتك وموقعك
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActivePillar('referral_rewards')}
            className={`p-4 rounded-xl border text-right space-y-1 transition-colors cursor-pointer ${
              activePillar === 'referral_rewards'
                ? 'bg-[#252321] text-[#F7F2E9] border-[#252321]'
                : 'bg-[#F7F2E9]/70 text-[#252321] border-[#B98A78]/35 hover:bg-[#EDE6DA]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-display font-bold flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-[#D8755B]" />
                <span>3. محرك مكافآت الدعوة (${REFERRAL_REWARD_USD})</span>
              </span>
              <span className="text-xs font-mono font-bold text-[#D8755B]">
                ${referralStats.totalEarnedUsd}
              </span>
            </div>
            <p className="text-[11px] opacity-75">
              إيداع ذري بقيمة +${REFERRAL_REWARD_USD} في محفظتك لكل اشتراك سنوي مفعل
            </p>
          </button>
        </div>
      </div>

      {/* =====================================================================
          PILLAR 1: KINSHIP CIRCLE, SMART OPT-OUT INVITES & AUTHORIZED PORTALS
         ===================================================================== */}
      {activePillar === 'kinship_circle' && (
        <div className="space-y-6">
          {/* Authorized Family Portals for Current User («البوابات العائلية المصرّح لي بدخولها») */}
          <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-display font-bold text-[#252321] flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#8D4925]" />
                  <span>البوابات العائلية المصرّح لي بدخولها</span>
                </h3>
                <p className="text-xs text-[#252321]/70">
                  المواقع العائلية التي أُضيف بريدك ({userEmail || '—'}) إلى دائرتها الخاصة لتصفحها واقتراح الإثراء فيها
                </p>
              </div>
            </div>

            {authorizedPortals.length === 0 ? (
              <div className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/30 p-4 text-xs text-[#252321]/70">
                عندما يدعوك أحد أمناء السجل من أقاربك إلى بوابته العائلية الخاصة ستظهر بوابته هنا تلقائياً لتتمكن من زيارتها واقتراح الإثراءات.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {authorizedPortals.map((portal) => (
                  <a
                    key={portal.siteSlug}
                    href={`/${portal.siteSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-[#F7F2E9] hover:bg-[#EDE6DA] border border-[#B98A78]/45 p-4 flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="text-sm font-display font-bold text-[#252321]">
                        ديوان أسرة {portal.familyName}
                      </div>
                      <div className="text-[11px] text-[#252321]/70">
                        إشراف: {portal.ownerDisplayName}
                      </div>
                      <div
                        dir="ltr"
                        className="text-[11px] font-mono text-[#8D4925] mt-1"
                      >
                        Juthori.com/{portal.siteSlug}
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-[#D8755B] shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Pending Private Whitelist Site Access Requests */}
          {accessRequests.length > 0 && (
            <div className="rounded-2xl bg-white border border-[#D8755B]/50 p-6 space-y-4">
              <h3 className="text-base font-display font-bold text-[#252321]">
                طلبات الاستئذان الواردة لدخول بوابة عائلتك الخاصة ({accessRequests.length})
              </h3>
              <div className="space-y-2.5">
                {accessRequests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/40 p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="text-xs space-y-0.5">
                      <div className="font-display font-bold text-sm text-[#252321]">
                        {req.visitorName}{' '}
                        <span className="font-mono text-[#8D4925]">
                          ({req.visitorEmail})
                        </span>
                      </div>
                      {req.kinshipNote && (
                        <div className="text-[#252321]/75">
                          صلة القرابة المذكورة: {req.kinshipNote}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await resolveSiteAccessRequest({
                            request: req,
                            approve: true,
                            ownerName: ownerFullName,
                          });
                          setAccessRequests((prev) =>
                            prev.filter((x) => x.id !== req.id)
                          );
                          if (userId) {
                            setCircle(await fetchKinshipCircleForOwner(userId));
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-[#252321] text-white text-xs font-bold cursor-pointer"
                      >
                        قبول وإرسال دعوة دخول ✓
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await resolveSiteAccessRequest({
                            request: req,
                            approve: false,
                            ownerName: ownerFullName,
                          });
                          setAccessRequests((prev) =>
                            prev.filter((x) => x.id !== req.id)
                          );
                        }}
                        className="px-3 py-1.5 rounded-lg border border-[#B98A78]/50 text-xs text-[#252321]/75 cursor-pointer"
                      >
                        اعتذار
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Relative & Smart Resend Email Invitation */}
          <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 space-y-5">
            <div className="space-y-1">
              <h3 className="text-base font-display font-bold text-[#252321] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#8D4925]" />
                <span>إضافة قريب إلى دائرة عائلتي وإرسال دعوة بريدية ذكية</span>
              </h3>
              <p className="text-xs text-[#252321]/70 leading-relaxed">
                بمجرد إضافة القريب يُمنح صلاحية فورية لرؤية الأقسام العائلية الخاصة في «موقعي»، وتُرسل إليه رسالة ترحيبية عبر البريد تتضمن رابط البوابة وخيار خصوصية لإلغاء الارتباط بضغطة واحدة (Opt-out) متى رغب.
              </p>
            </div>

            {circleBanner && (
              <div className="rounded-xl bg-emerald-950/5 border border-emerald-700/35 p-3.5 text-xs font-semibold text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{circleBanner}</span>
              </div>
            )}

            <form
              onSubmit={handleAddRelativeAndSendEmail}
              className="grid grid-cols-1 sm:grid-cols-4 gap-3"
            >
              <input
                type="text"
                required
                value={relName}
                onChange={(e) => setRelName(e.target.value)}
                placeholder="اسم القريب الكريم *"
                className="px-3.5 py-2.5 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="text"
                required
                value={relKinship}
                onChange={(e) => setRelKinship(e.target.value)}
                placeholder="صلة القرابة (شقيق، ابن عم، خال...)"
                className="px-3.5 py-2.5 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="email"
                dir="ltr"
                required
                value={relEmail}
                onChange={(e) => setRelEmail(e.target.value)}
                placeholder="البريد الإلكتروني للقريب *"
                className="px-3.5 py-2.5 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <button
                type="submit"
                disabled={inviting}
                className="px-4 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {inviting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                <span>إضافة وإرسال الدعوة</span>
              </button>
            </form>

            {/* Current Kinship Circle Table */}
            <div className="pt-2 space-y-2">
              <div className="text-xs font-bold text-[#252321]">
                أفراد دائرة عائلتي المعتمدون ({circle.members.length}):
              </div>
              {circle.members.length === 0 ? (
                <div className="rounded-xl bg-[#F7F2E9] p-5 text-center text-xs text-[#252321]/65">
                  لم تتم إضافة أقارب بعد في دائرة عائلتك الخاصة. أضف أول قريب أعلاه لمنحه صلاحية الدخول الفوري لبوابتك.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {circle.members.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-4 flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5 text-xs">
                        <div className="font-display font-bold text-sm text-[#252321]">
                          {m.name}{' '}
                          <span className="text-[#8D4925] text-xs font-normal">
                            ({m.kinshipRelation})
                          </span>
                        </div>
                        <div
                          dir="ltr"
                          className="font-mono text-[11px] text-[#252321]/70 text-right"
                        >
                          {m.email}
                        </div>
                        {m.approvedEnrichmentsCount > 0 && (
                          <div className="text-[11px] font-bold text-[#D8755B]">
                            ✦ ساهم بـ {m.approvedEnrichmentsCount} إثراء معتمد في السجل
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!userId) return;
                          const next = await removeRelativeFromKinshipCircle({
                            ownerId: userId,
                            memberEmail: m.email,
                          });
                          setCircle(next);
                        }}
                        className="p-2 rounded-lg text-red-700 hover:bg-red-950/10 cursor-pointer"
                        title="إلغاء صلاحية القريب"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PILLAR 2: CLOSED-LOOP ENRICHMENT INBOX & GUARDIANS OF MEMORY
         ===================================================================== */}
      {activePillar === 'enrichment_inbox' && (
        <div className="space-y-6">
          {accountType !== AccountLegalType.RecordKeeper &&
          !caps.hasRegistrarBadge ? (
            <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 sm:p-8 space-y-4">
              <div className="flex items-center gap-3">
                <FileSignature className="w-6 h-6 text-[#8D4925]" />
                <h3 className="text-lg font-display font-bold text-[#252321]">
                  اعتماد طلبات الإثراء مخصص لأمناء السجل الموقعين على الميثاق
                </h3>
              </div>
              <p className="text-xs text-[#252321]/75 leading-relaxed max-w-2xl">
                عندما توقّع ميثاق أمين السجل وتنشر بوابة «موقعي»، ستصل جميع مقترحات إضافة المواليد والفروع والصور التراثية من أقاربك إلى هذا الصندوق لتعتمدها بضغطة زر واحدة.
              </p>
              {caps.isVip && onSignCharterAndEnableTree && (
                <button
                  type="button"
                  onClick={onSignCharterAndEnableTree}
                  className="px-5 py-2.5 rounded-xl bg-[#252321] text-[#F7F2E9] text-xs font-display font-bold cursor-pointer"
                >
                  توقيع ميثاق أمين السجل الآن ✦
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/25 pb-4">
                <div>
                  <h3 className="text-base font-display font-bold text-[#252321]">
                    صندوق مقترحات الإثراء العائلي الواردة من «موقعي»
                  </h3>
                  <p className="text-xs text-[#252321]/70">
                    كل اعتماد يدمج البيان تلقائياً في «شجرتي» أو «خزانتي» الخاصة ويحدّث المرآة المفلترة في «موقعي» فوراً
                  </p>
                </div>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab(DashboardTab.MyTree)}
                    className="text-xs font-bold text-[#8D4925] hover:underline cursor-pointer"
                  >
                    استعراض شجرتي الخاصة ←
                  </button>
                )}
              </div>

              {enrichmentBanner && (
                <div className="rounded-xl bg-emerald-950/5 border border-emerald-700/35 p-3.5 text-xs font-semibold text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{enrichmentBanner}</span>
                </div>
              )}

              {enrichmentRequests.length === 0 ? (
                <div className="rounded-xl bg-[#F7F2E9] p-8 text-center space-y-2">
                  <Inbox className="w-7 h-7 text-[#8D4925] mx-auto opacity-70" />
                  <div className="text-sm font-display font-bold text-[#252321]">
                    لا توجد طلبات إثراء واردة حالياً
                  </div>
                  <p className="text-xs text-[#252321]/65 max-w-md mx-auto">
                    شارك رابط بوابة «موقعي» أو بطاقة الـ QR مع أفراد عائلتك ليتمكنوا من اقتراح المواليد الجدد والصور الأرشيفية.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {enrichmentRequests.map((req) => {
                    const isPending =
                      req.status === 'PENDING_REGISTRAR_APPROVAL';
                    const busy = processingReqId === req.id;
                    return (
                      <div
                        key={req.id}
                        className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/45 p-5 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="font-bold text-[#8D4925]">
                            {req.requestType === 'ADD_TREE_MEMBER'
                              ? '✦ مقترح إضافة مولود / فرع في المشجرة'
                              : req.requestType === 'VAULT_MEDIA'
                              ? '✦ إهداء صورة / وثيقة لخزانة الأسرة'
                              : '✦ تصحيح / إثراء سيرة فرد'}
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-md font-bold text-[11px] ${
                              isPending
                                ? 'bg-amber-900/15 text-amber-900'
                                : req.status === 'APPROVED_AND_MERGED'
                                ? 'bg-emerald-900/15 text-emerald-900'
                                : 'bg-red-900/15 text-red-900'
                            }`}
                          >
                            {isPending
                              ? 'بانتظار مراجعة أمين السجل'
                              : req.status === 'APPROVED_AND_MERGED'
                              ? 'تم الاعتماد والدمج في السجل ✓'
                              : 'مرفوض'}
                          </span>
                        </div>

                        <div className="text-sm font-display font-bold text-[#252321]">
                          مقدّم المقترح: {req.requesterName}
                          {req.kinshipRelation ? ` (${req.kinshipRelation})` : ''}
                        </div>

                        {req.targetPersonName && (
                          <div className="text-xs text-[#252321]/80">
                            <strong>الأب / الفرد المرتبط في الشجرة:</strong>{' '}
                            {req.targetPersonName}
                          </div>
                        )}

                        {req.requestType === 'ADD_TREE_MEMBER' && (
                          <div className="text-xs text-[#252321] bg-white rounded-lg p-3 border border-[#B98A78]/30">
                            <strong>الاسم المقترح إضافته:</strong>{' '}
                            {req.proposedFirstName} {result.familyName} (
                            {req.proposedGender === 'female' ? 'أنثى' : 'ذكر'})
                            {req.proposedBirthYear
                              ? ` · مواليد ${req.proposedBirthYear}`
                              : ''}
                            {req.proposedBirthPlace
                              ? ` · ${req.proposedBirthPlace}`
                              : ''}
                          </div>
                        )}

                        {req.requestType === 'VAULT_MEDIA' && (
                          <div className="text-xs text-[#252321] bg-white rounded-lg p-3 border border-[#B98A78]/30 space-y-2">
                            <div>
                              <strong>عنوان المادة:</strong> {req.mediaTitle}{' '}
                              {req.mediaDateOrOccasion
                                ? `(${req.mediaDateOrOccasion})`
                                : ''}
                            </div>
                            {req.mediaDataOrUrl && (
                              <img
                                src={req.mediaDataOrUrl}
                                alt={req.mediaTitle || 'مرفق'}
                                className="h-28 rounded-lg object-cover border border-[#B98A78]/35"
                              />
                            )}
                          </div>
                        )}

                        {req.proposedNotes && (
                          <p className="text-xs text-[#252321]/80 leading-relaxed">
                            <strong>ملاحظات المساهم:</strong> {req.proposedNotes}
                          </p>
                        )}

                        {isPending && (
                          <div className="pt-2 flex flex-wrap items-center gap-2.5 border-t border-[#B98A78]/25">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleApproveOrRejectEnrichment(req, true)
                              }
                              className="px-4 py-2 rounded-xl bg-[#252321] hover:bg-[#383430] text-[#F7F2E9] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {busy ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <GitMerge className="w-3.5 h-3.5 text-[#D8755B]" />
                              )}
                              <span>اعتماد ودمج في سجلاتي ✦</span>
                            </button>

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleApproveOrRejectEnrichment(req, false)
                              }
                              className="px-3.5 py-2 rounded-xl border border-red-800/30 text-red-800 hover:bg-red-950/5 text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>رفض المقترح</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Guardians of Memory Leaderboard */}
          {guardiansLeaderboard.length > 0 && (
            <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-[#D8755B]" />
                <h3 className="text-base font-display font-bold text-[#252321]">
                  سجل «حماة الذاكرة» (الأقارب الأكثر إثراءً وتوثيقاً للسجل)
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {guardiansLeaderboard.map((g, idx) => (
                  <div
                    key={g.id}
                    className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-4 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-[11px] font-bold text-[#8D4925]">
                        المرتبة #{idx + 1}
                      </div>
                      <div className="text-sm font-display font-bold text-[#252321]">
                        {g.name}
                      </div>
                      <div className="text-[11px] text-[#252321]/65">
                        {g.kinshipRelation}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-lg font-display font-bold text-[#D8755B]">
                        {g.approvedEnrichmentsCount}
                      </div>
                      <div className="text-[10px] text-[#252321]/60">
                        إثراء معتمد
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          PILLAR 3: ATOMIC $10 REFERRAL REWARDS ENGINE
         ===================================================================== */}
      {activePillar === 'referral_rewards' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-[#252321] text-[#F7F2E9] p-6 sm:p-8 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-2xl">
                <div className="text-xs font-bold text-[#D8755B]">
                  برنامج سفراء الأنساب وصلة الرحم · مكافأة مالية ذرية فورية
                </div>
                <h3 className="text-xl sm:text-2xl font-display font-bold">
                  احصل على +${REFERRAL_REWARD_USD} رصيد محفظة فوري عن كل قريب أو صديق يفعل اشتراكه السنوي
                </h3>
                <p className="text-xs text-[#F7F2E9]/80 leading-relaxed">
                  عندما يسجّل المدعو عبر رابط دعوتك الخاص ويفعّل اشتراكه السنوي الأول (Premium أو أمين سجل)، يودع النظام ذرياً عبر معاملة مالية موثقة مبلغ <strong>+${REFERRAL_REWARD_USD}</strong> مباشرةً في محفظتك لتستخدمها في فتح كبسولات الأجداد أو تجديد باقاتك.
                </p>
              </div>

              <div className="rounded-xl bg-white/10 border border-white/15 px-5 py-4 text-center shrink-0">
                <div className="text-[11px] text-[#F7F2E9]/70">رمز دعوتك الموحد</div>
                <div
                  dir="ltr"
                  className="text-lg font-mono font-bold text-[#D8755B] mt-0.5"
                >
                  {referralStats.referralCode}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
              <div
                dir="ltr"
                className="flex-1 px-4 py-2.5 rounded-xl bg-black/30 border border-white/15 font-mono text-xs text-[#F7F2E9] truncate"
              >
                {personalInviteLink}
              </div>
              <button
                type="button"
                onClick={handleCopyInviteUrl}
                className="px-4 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                {copiedInviteUrl ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>نسخ رابط الإحالة</span>
                  </>
                )}
              </button>
              <a
                href={whatsappReferralHref}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-[#1F6E43] hover:bg-[#185835] text-white text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 shrink-0"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>واتساب</span>
              </a>
              <a
                href={telegramReferralHref}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-[#25638A] hover:bg-[#1d4f6e] text-white text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>تيليجرام</span>
              </a>
            </div>
          </div>

          {/* KPI Counters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-5">
              <div className="text-xs text-[#252321]/65">
                إجمالي المسجلين عبر رابطك
              </div>
              <div className="text-2xl font-display font-bold text-[#252321] mt-1">
                {referralStats.registeredCount}
              </div>
              <div className="text-[11px] text-[#252321]/55 mt-1">
                التسجيل المجاني يربط الحساب برمزك بانتظار الترقية السنوية
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-5">
              <div className="text-xs text-[#252321]/65">
                المشتركون السنويون المفعلون
              </div>
              <div className="text-2xl font-display font-bold text-[#8D4925] mt-1">
                {referralStats.rewardedAnnualCount}
              </div>
              <div className="text-[11px] text-[#252321]/55 mt-1">
                استحققت عن كل مشترك منهم مكافأة +${REFERRAL_REWARD_USD}
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-5">
              <div className="text-xs text-[#252321]/65">
                إجمالي المكافآت المودعة في محفظتك
              </div>
              <div className="text-2xl font-display font-bold text-[#D8755B] mt-1">
                ${referralStats.totalEarnedUsd.toFixed(2)}
              </div>
              <div className="text-[11px] text-[#252321]/55 mt-1">
                مسجلة رسمياً في سجل معاملات محفظتك تحت بند REFERRAL_REWARD
              </div>
            </div>
          </div>

          {/* Invitees Ledger */}
          <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 space-y-3">
            <h4 className="text-sm font-display font-bold text-[#252321]">
              سجل المدعوين وحالة استحقاق المكافأة
            </h4>
            {referralStats.invitees.length === 0 ? (
              <div className="rounded-xl bg-[#F7F2E9] p-5 text-xs text-[#252321]/65 text-center">
                لم يسجّل أحد عبر رابط إحالتك بعد. شارك رابطك أعلاه مع أبناء عمومتك وأقاربك للبدء!
              </div>
            ) : (
              <div className="space-y-2">
                {referralStats.invitees.map((inv) => (
                  <div
                    key={inv.userId}
                    className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-3.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <strong className="font-display text-[#252321]">
                        {inv.fullName}
                      </strong>
                      <div className="text-[11px] text-[#252321]/60">
                        تاريخ الانضمام:{' '}
                        {new Date(inv.createdAt).toLocaleDateString('ar-SA')}
                      </div>
                    </div>
                    {inv.status === 'REWARDED_10_USD' ? (
                      <span className="px-3 py-1 rounded-lg bg-emerald-900/15 text-emerald-900 font-bold">
                        مفعّل سنوياً · أُودعت +${REFERRAL_REWARD_USD} ✓
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-lg bg-amber-900/10 text-[#8D4925] font-semibold">
                        مسجل مجاناً · بانتظار الترقية السنوية (+${REFERRAL_REWARD_USD})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
