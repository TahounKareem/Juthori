import React, { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck,
  Check,
  Copy,
  Globe,
  Loader2,
  Lock,
  QrCode,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  CircleJoinRequestDoc,
  FemaleDisplayPolicy,
  KinshipCircleDoc,
  KinshipCircleMember,
  KinshipCircleMemberRole,
  SiteAccessMode,
  addRelativeToKinshipCircleAndSendInvite,
  buildDeterministicReferralCode,
  fetchKinshipCircleForOwner,
  removeRelativeFromKinshipCircle,
  subscribeToOwnerPendingJoinRequests,
  updateKinshipCircleMemberMeta,
} from '../services/priority4Service';
import {
  CIRCLE_PERMISSION_TIERS,
  CircleRoleKey,
  JUTHORI_KINSHIP_CIRCLE_SYNC_EVENT,
  normalizeCircleRoleKey,
} from '../utils/enrichmentStagingUtils';
import { ModernSwitch } from './MySiteStudioControls';
import { SocialJoinRequestsList } from './CircleJoinRequestsPanel';

interface MySiteLinkPrivacyPanelProps {
  officialBrandHost: string;
  siteSlug: string;
  cleanSlugDisplay: string;
  onChangeSiteSlug: (nextSlug: string) => void;
  slugStatus: {
    checking: boolean;
    available?: boolean;
    message?: string;
  };
  onCheckSlug: () => void;
  copiedUrl: boolean;
  onCopyPortalUrl: () => void;
  onOpenQrModal: () => void;
  siteAccessMode: SiteAccessMode;
  onChangeSiteAccessMode: (mode: SiteAccessMode) => void;
  femaleDisplayPolicy: FemaleDisplayPolicy;
  onChangeFemaleDisplayPolicy: (policy: FemaleDisplayPolicy) => void;
  hideLivingNamesForGuests: boolean;
  onChangeHideLivingNamesForGuests: (next: boolean) => void;
  hideLivingBirthDates: boolean;
  onChangeHideLivingBirthDates: (next: boolean) => void;
  allowCircleMembersEnrichment: boolean;
  onChangeAllowCircleMembersEnrichment: (next: boolean) => void;
  allowPublicMajlis: boolean;
  onChangeAllowPublicMajlis: (next: boolean) => void;
  majlisEnabled: boolean;
  onChangeMajlisEnabled: (next: boolean) => void;
  ownerId: string;
  ownerName: string;
  familyName: string;
  originCountry?: string;
  originRegion?: string;
}

const FEMALE_DISPLAY_OPTIONS: ReadonlyArray<{
  id: FemaleDisplayPolicy;
  title: string;
  desc: string;
}> = [
  {
    id: 'SHOW_ALL',
    title: 'إظهار الأسماء الكاملة',
    desc: 'تُعرض الأسماء كما هي موثقة في «شجرتي».',
  },
  {
    id: 'SYMBOLIC_TITLE',
    title: 'لقب رمزي (كريمة / سيدة)',
    desc: 'يُعرض اللقب الرمزي فقط حفاظاً على خصوصية العائلة.',
  },
  {
    id: 'FAMILY_CIRCLE_ONLY',
    title: 'لدائرة العائلة فقط',
    desc: 'تُخفى عن الضيوف وتظهر لأعضاء الدائرة الموثقين.',
  },
  {
    id: 'HIDE_ALL',
    title: 'إخفاء كامل في الموقع العام',
    desc: 'لا تُعرض في الشجرة المنشورة مع بقائها محفوظة في «شجرتي».',
  },
];

export const MySiteLinkPrivacyPanel: React.FC<MySiteLinkPrivacyPanelProps> = ({
  officialBrandHost,
  siteSlug,
  cleanSlugDisplay,
  onChangeSiteSlug,
  slugStatus,
  onCheckSlug,
  copiedUrl,
  onCopyPortalUrl,
  onOpenQrModal,
  siteAccessMode,
  onChangeSiteAccessMode,
  femaleDisplayPolicy,
  onChangeFemaleDisplayPolicy,
  hideLivingNamesForGuests,
  onChangeHideLivingNamesForGuests,
  hideLivingBirthDates,
  onChangeHideLivingBirthDates,
  allowCircleMembersEnrichment,
  onChangeAllowCircleMembersEnrichment,
  allowPublicMajlis,
  onChangeAllowPublicMajlis,
  majlisEnabled,
  onChangeMajlisEnabled,
  ownerId,
  ownerName,
  familyName,
  originCountry,
  originRegion,
}) => {
  const isPublicMode = siteAccessMode !== 'PRIVATE_WHITELIST';
  const hideFromSearchEngines = siteAccessMode === 'UNLISTED';

  // Embedded Live Kinship Circle Manager State (100% synced with «مجتمعي» & Firestore)
  const [circleMembers, setCircleMembers] = useState<KinshipCircleMember[]>([]);
  const [loadingCircle, setLoadingCircle] = useState<boolean>(true);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<
    CircleJoinRequestDoc[]
  >([]);
  const [circleFeedback, setCircleFeedback] = useState<string | null>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  // Inline quick-invite form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteKinship, setInviteKinship] = useState('');
  const [inviteRole, setInviteRole] = useState<CircleRoleKey>('family_viewer');
  const [inviting, setInviting] = useState(false);

  const loadCircle = useCallback(async () => {
    if (!ownerId) {
      setCircleMembers([]);
      setLoadingCircle(false);
      return;
    }
    try {
      const circle = await fetchKinshipCircleForOwner(ownerId);
      setCircleMembers(circle.members || []);
    } catch {
      // keep existing state on transient offline read
    } finally {
      setLoadingCircle(false);
    }
  }, [ownerId]);

  useEffect(() => {
    loadCircle();
  }, [loadCircle]);

  // Real-time pending social join requests subscription
  useEffect(() => {
    if (!ownerId) {
      setPendingJoinRequests([]);
      return;
    }
    const unsub = subscribeToOwnerPendingJoinRequests(ownerId, (items) => {
      setPendingJoinRequests(items);
    });
    return () => unsub();
  }, [ownerId]);

  // Bidirectional live sync listener with «مجتمعي» and Notifications Drawer
  useEffect(() => {
    const onCircleSync = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{ ownerId?: string; circle?: KinshipCircleDoc }>
      ).detail;
      if (detail?.circle && Array.isArray(detail.circle.members)) {
        setCircleMembers(detail.circle.members);
      } else {
        loadCircle();
      }
    };
    window.addEventListener(JUTHORI_KINSHIP_CIRCLE_SYNC_EVENT, onCircleSync);
    return () =>
      window.removeEventListener(
        JUTHORI_KINSHIP_CIRCLE_SYNC_EVENT,
        onCircleSync
      );
  }, [loadCircle]);

  const showTransientCircleNotice = (msg: string) => {
    setCircleFeedback(msg);
    window.setTimeout(() => {
      setCircleFeedback((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  const handleRoleChange = async (
    member: KinshipCircleMember,
    nextRole: CircleRoleKey
  ) => {
    setBusyMemberId(member.id);
    try {
      const updated = await updateKinshipCircleMemberMeta({
        ownerId,
        memberId: member.id,
        role: nextRole,
        siteSlug: cleanSlugDisplay,
      });
      setCircleMembers(updated.members || []);
      showTransientCircleNotice(
        `تم تحديث صلاحية «${member.name}» ومزامنتها فوراً مع بوابة العائلة و«مجتمعي».`
      );
    } catch {
      showTransientCircleNotice('تعذّر تحديث الصلاحية حالياً، يرجى إعادة المحاولة.');
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleRemoveMember = async (member: KinshipCircleMember) => {
    setBusyMemberId(member.id);
    try {
      const updated = await removeRelativeFromKinshipCircle({
        ownerId,
        memberEmail: member.email,
        siteSlug: cleanSlugDisplay,
      });
      setCircleMembers(updated.members || []);
      showTransientCircleNotice(`تمت إزالة «${member.name}» من دائرة العائلة.`);
    } catch {
      showTransientCircleNotice('تعذّر إزالة العضو حالياً، يرجى المحاولة مجدداً.');
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleInlineInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = inviteName.trim();
    const cleanEmail = inviteEmail.trim().toLowerCase();
    const cleanKinship = inviteKinship.trim() || 'قريب من العائلة';
    if (!cleanName || !cleanEmail || !cleanEmail.includes('@')) {
      showTransientCircleNotice('يرجى إدخال اسم القريب وبريده الإلكتروني بشكل صحيح.');
      return;
    }

    setInviting(true);
    try {
      const res = await addRelativeToKinshipCircleAndSendInvite({
        ownerId,
        ownerName: ownerName || 'أمين السجل',
        familyName: familyName || 'العائلة',
        originCountry,
        originRegion,
        siteSlug: cleanSlugDisplay,
        referralCode: buildDeterministicReferralCode(ownerId),
        relativeName: cleanName,
        kinshipRelation: cleanKinship,
        relativeEmail: cleanEmail,
        role: inviteRole,
      });
      setCircleMembers(res.circle.members || []);
      setInviteName('');
      setInviteEmail('');
      setInviteKinship('');
      setInviteRole('family_viewer');
      setShowInviteForm(false);
      showTransientCircleNotice(
        `تمت إضافة «${cleanName}» لدائرة العائلة وإرسال دعوته بنجاح ✓`
      );
    } catch {
      showTransientCircleNotice('تعذّر إرسال الدعوة حالياً، يرجى المحاولة لاحقاً.');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="mysite-pillar-link-privacy">
      {/* ================================================================= */}
      {/* 1. DIRECT PORTAL URL & QR INVITATION                              */}
      {/* ================================================================= */}
      <section className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[13.5px] font-display font-extrabold text-[#1F1F1C]">
                الرابط المباشر لبوابة العائلة
              </h3>
              <p className="text-[11px] text-[#1F1F1C]/70">
                اختر اسماً نظيفاً وسهل المشاركة في مجموعات العائلة وبطاقات الدعوة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenQrModal}
            className="h-9 px-3.5 rounded-xl bg-[#FDFBF7] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <QrCode className="w-3.5 h-3.5 text-[#D97757]" />
            <span>بطاقة الدعوة وQR</span>
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <div
              dir="ltr"
              className="flex-1 flex items-center rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] px-3 h-10 focus-within:border-[#D97757] transition-colors"
            >
              <span className="text-xs font-mono font-semibold text-[#D97757] select-none shrink-0">
                {officialBrandHost}/
              </span>
              <input
                type="text"
                value={siteSlug}
                onChange={(e) => onChangeSiteSlug(e.target.value)}
                placeholder="al-family"
                aria-label="معرف رابط بوابة العائلة"
                className="flex-1 bg-transparent px-1.5 text-xs font-mono font-bold text-[#1F1F1C] focus:outline-none min-w-0"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onCheckSlug}
                disabled={slugStatus.checking}
                className="h-10 px-3.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#FDFBF7] text-xs font-display font-bold cursor-pointer disabled:opacity-60 transition-colors whitespace-nowrap"
              >
                {slugStatus.checking ? 'جاري الفحص...' : 'فحص التوفر'}
              </button>
              <button
                type="button"
                onClick={onCopyPortalUrl}
                className="h-10 px-3.5 rounded-xl bg-[#FDFBF7] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#D97757]" />
                    <span className="text-[#1F1F1C]">تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#D97757]" />
                    <span>نسخ الرابط</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span dir="ltr" className="font-mono text-[#D97757]">
              https://{officialBrandHost}/{cleanSlugDisplay}
            </span>
            {slugStatus.message && (
              <span className="font-bold text-[#D97757]">
                {slugStatus.message}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 2. STRICT IDENTITY-BASED ACCESS SCOPE (CLEAN 2-MODE SELECTOR)     */}
      {/* ================================================================= */}
      <section className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-[13.5px] font-display font-extrabold text-[#1F1F1C]">
              نطاق الوصول لبوابة العائلة
            </h3>
            <p className="text-[11px] text-[#1F1F1C]/70">
              حوكمة وصول معتمدة على هوية حساب جذوري فقط — دون رموز سرية قابلة للتسريب
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Option 1: Public Portal */}
          <button
            type="button"
            onClick={() =>
              onChangeSiteAccessMode(
                hideFromSearchEngines ? 'UNLISTED' : 'PUBLIC'
              )
            }
            className={`rounded-xl p-4 border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
              isPublicMode
                ? 'bg-[#FDFBF7] border-[#D97757] ring-1 ring-[#D97757]/35'
                : 'bg-[#FAF7F2] border-[#D8C7B2] hover:border-[#D97757]/50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#D97757] shrink-0" />
                <span className="text-xs font-display font-extrabold text-[#1F1F1C]">
                  بوابة عامة
                </span>
              </div>
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  isPublicMode
                    ? 'border-[#D97757] bg-[#D97757] text-[#FDFBF7]'
                    : 'border-[#D8C7B2] bg-[#FDFBF7]'
                }`}
              >
                {isPublicMode && <Check className="w-2.5 h-2.5" />}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#1F1F1C]/75">
              متاحة للعرض للجميع عبر الرابط المباشر، بينما تبقى صلاحيات إثراء
              الشجرة والخزانة محصورة بأعضاء دائرة العائلة المعتمدين فقط.
            </p>
          </button>

          {/* Option 2: Private Identity-Based Whitelist */}
          <button
            type="button"
            onClick={() => onChangeSiteAccessMode('PRIVATE_WHITELIST')}
            className={`rounded-xl p-4 border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
              !isPublicMode
                ? 'bg-[#FDFBF7] border-[#D97757] ring-1 ring-[#D97757]/35'
                : 'bg-[#FAF7F2] border-[#D8C7B2] hover:border-[#D97757]/50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#D97757] shrink-0" />
                <span className="text-xs font-display font-extrabold text-[#1F1F1C]">
                  خاص لدائرة العائلة المعتمدة فقط
                </span>
              </div>
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  !isPublicMode
                    ? 'border-[#D97757] bg-[#D97757] text-[#FDFBF7]'
                    : 'border-[#D8C7B2] bg-[#FDFBF7]'
                }`}
              >
                {!isPublicMode && <Check className="w-2.5 h-2.5" />}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#1F1F1C]/75">
              لا يُفتح الموقع إلا للمستخدمين المسجلين في «جذوري» والمدرجين في
              دائرة العائلة أدناه؛ ويمكن لبقية الأقارب إرسال طلب انضمام موثّق.
            </p>
          </button>
        </div>

        {/* Sub-toggle for Public mode: Search Engine Indexing */}
        {isPublicMode ? (
          <div className="rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-display font-bold text-[#1F1F1C]">
                إخفاء من أرشفة محركات البحث (الرابط المباشر فقط)
              </div>
              <p className="text-[11px] text-[#1F1F1C]/70 mt-0.5">
                عند التفعيل لا تظهر البوابة في نتائج Google ويصل إليها فقط من
                تشارك معه الرابط
              </p>
            </div>
            <ModernSwitch
              checked={hideFromSearchEngines}
              onChange={(next) =>
                onChangeSiteAccessMode(next ? 'UNLISTED' : 'PUBLIC')
              }
              ariaLabel="إخفاء من أرشفة محركات البحث"
            />
          </div>
        ) : (
          <div className="rounded-xl bg-[#FDFBF7] border border-[#D97757]/45 px-4 py-3 flex items-start gap-2.5 text-[11.5px] text-[#1F1F1C]">
            <ShieldCheck className="w-4 h-4 text-[#D97757] shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="font-display font-extrabold">
                حماية بالهوية الموثّقة فقط:
              </strong>{' '}
              يُفتح الديوان تلقائياً لك ولأفراد دائرة العائلة المعتمدين أدناه فور
              تسجيل دخولهم في «جذوري»، وأي قريب غير مُضاف تظهر له بوابة أنيقة
              لإرسال طلب انضمام تصلك فوراً للموافقة بنقرة واحدة.
            </div>
          </div>
        )}
      </section>

      {/* ================================================================= */}
      {/* 3. EMBEDDED KINSHIP CIRCLE & PERMISSIONS MANAGER (LIVE SYNC)      */}
      {/* ================================================================= */}
      <section
        className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-5 space-y-4"
        data-testid="mysite-embedded-circle-manager"
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[13.5px] font-display font-extrabold text-[#1F1F1C]">
                دائرة العائلة وصلاحيات الدخول والإثراء
              </h3>
              <p className="text-[11px] text-[#1F1F1C]/70">
                متزامنة لحظياً مع تبويب «مجتمعي» وجرس الإشعارات — أدر الطلبات
                والأعضاء من مكان واحد
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowInviteForm((v) => !v)}
            className="h-9 px-3.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#FDFBF7] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{showInviteForm ? 'إغلاق نموذج الدعوة' : '+ دعوة قريب جديد للدائرة'}</span>
          </button>
        </div>

        {circleFeedback && (
          <div className="rounded-xl bg-[#FDFBF7] border border-[#D97757]/50 px-3.5 py-2.5 text-xs font-display font-bold text-[#1F1F1C] flex items-center gap-2">
            <Check className="w-4 h-4 text-[#D97757] shrink-0" />
            <span>{circleFeedback}</span>
          </div>
        )}

        {/* Collapsible inline invite form */}
        {showInviteForm && (
          <form
            onSubmit={handleInlineInviteSubmit}
            className="rounded-2xl bg-[#FDFBF7] border border-[#D8C7B2] p-4 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                required
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="اسم القريب الكامل *"
                className="h-10 rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] px-3 text-xs text-[#1F1F1C] placeholder:text-[#1F1F1C]/45 focus:outline-none focus:border-[#D97757]"
              />
              <input
                type="email"
                required
                dir="ltr"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="relative@example.com"
                className="h-10 rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] px-3 text-xs font-mono text-[#1F1F1C] placeholder:text-[#1F1F1C]/45 focus:outline-none focus:border-[#D97757]"
              />
              <input
                type="text"
                value={inviteKinship}
                onChange={(e) => setInviteKinship(e.target.value)}
                placeholder="صلة القرابة (مثال: شقيق، ابن عم)"
                className="h-10 rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] px-3 text-xs text-[#1F1F1C] placeholder:text-[#1F1F1C]/45 focus:outline-none focus:border-[#D97757]"
              />
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(normalizeCircleRoleKey(e.target.value))
                }
                aria-label="مستوى صلاحية القريب المدعو"
                className="h-10 rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] px-3 text-xs font-display font-bold text-[#1F1F1C] focus:outline-none focus:border-[#D97757] cursor-pointer"
              >
                {CIRCLE_PERMISSION_TIERS.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.labelAr}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className="h-9 px-3.5 rounded-xl bg-[#E8DED2] hover:bg-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={inviting}
                className="h-9 px-4 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#FDFBF7] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {inviting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>اعتماد وإرسال الدعوة</span>
              </button>
            </div>
          </form>
        )}

        {/* Pending Social Join Requests (Top of Circle Manager) */}
        {pendingJoinRequests.length > 0 && (
          <div className="rounded-2xl bg-[#FAF7F2] border border-[#D97757]/40 p-4">
            <SocialJoinRequestsList
              requests={pendingJoinRequests}
              ownerName={ownerName}
              variant="full"
              title="طلبات انضمام جديدة بانتظار قبولك"
              onApproved={(req, _role, updatedCircle) => {
                setCircleMembers(updatedCircle.members || []);
                showTransientCircleNotice(
                  `تم قبول «${req.requesterName}» في دائرة العائلة وتفعيل وصوله فوراً ✓`
                );
              }}
              onRejected={(req) => {
                showTransientCircleNotice(`تم حذف طلب «${req.requesterName}».`);
              }}
              onError={(msg) => showTransientCircleNotice(msg)}
            />
          </div>
        )}

        {/* Approved Circle Members List with instant 3-tier role switcher */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-display font-extrabold text-[#1F1F1C]">
              أفراد دائرة العائلة المعتمدون ({circleMembers.length})
            </span>
            <span className="text-[11px] text-[#1F1F1C]/65">
              تغيير الصلاحية يُطبّق فوراً على البوابة المنشورة
            </span>
          </div>

          {loadingCircle ? (
            <div className="rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] p-4 flex items-center justify-center gap-2 text-xs text-[#1F1F1C]/70">
              <Loader2 className="w-4 h-4 animate-spin text-[#D97757]" />
              <span>جاري تحميل أعضاء دائرة العائلة...</span>
            </div>
          ) : circleMembers.length === 0 ? (
            <div className="rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] p-4 text-center space-y-1">
              <p className="text-xs font-display font-bold text-[#1F1F1C]">
                لم تُضف بعد أي أقارب إلى دائرة عائلتك
              </p>
              <p className="text-[11px] text-[#1F1F1C]/70">
                اضغط «+ دعوة قريب جديد للدائرة» أو انتظر طلبات انضمام أقاربك عبر
                رابط البوابة.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {circleMembers.map((member) => {
                const roleKey = normalizeCircleRoleKey(member.role);
                const isBusy = busyMemberId === member.id;
                return (
                  <div
                    key={member.id}
                    className="rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] px-3.5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative w-9 h-9 rounded-full bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] font-display font-extrabold text-sm flex items-center justify-center shrink-0">
                        {(member.name || 'ق').charAt(0)}
                        {member.status === 'ACTIVE' && (
                          <span
                            title="عضو موثّق في جذوري"
                            className="absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 rounded-full bg-[#FDFBF7] text-[#D97757] flex items-center justify-center border border-[#D8C7B2]"
                          >
                            <BadgeCheck className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-display font-extrabold text-[#1F1F1C] truncate">
                            {member.name}
                          </span>
                          <span className="text-[10.5px] font-bold text-[#D97757]">
                            {member.kinshipRelation}
                          </span>
                        </div>
                        <div
                          dir="ltr"
                          className="text-[10.5px] font-mono text-[#1F1F1C]/65 truncate"
                        >
                          {member.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={roleKey}
                        disabled={isBusy}
                        onChange={(e) =>
                          handleRoleChange(
                            member,
                            normalizeCircleRoleKey(e.target.value)
                          )
                        }
                        aria-label={`مستوى صلاحية ${member.name}`}
                        className="h-8 rounded-lg bg-[#FAF7F2] border border-[#D8C7B2] px-2 text-[11px] font-display font-bold text-[#1F1F1C] focus:outline-none focus:border-[#D97757] cursor-pointer max-w-[230px]"
                      >
                        {CIRCLE_PERMISSION_TIERS.map((tier) => (
                          <option key={tier.id} value={tier.id}>
                            {tier.labelAr}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleRemoveMember(member)}
                        title="إزالة من دائرة العائلة"
                        aria-label={`إزالة ${member.name} من دائرة العائلة`}
                        className="w-8 h-8 rounded-lg bg-[#FAF7F2] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C]/70 hover:text-[#D97757] flex items-center justify-center cursor-pointer disabled:opacity-50 transition-colors shrink-0"
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ================================================================= */}
      {/* 4. PRIVACY & FAMILY PARTICIPATION CONTROLS (ZERO ANONYMOUS ENRICH)*/}
      {/* ================================================================= */}
      <section className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-[13.5px] font-display font-extrabold text-[#1F1F1C]">
              ضوابط الخصوصية والمشاركة العائلية
            </h3>
            <p className="text-[11px] text-[#1F1F1C]/70">
              تحكم دقيق في عرض بيانات الأحياء والنساء وصلاحيات التفاعل والإثراء
            </p>
          </div>
        </div>

        {/* Female display policy */}
        <div className="space-y-2">
          <label className="text-xs font-display font-extrabold text-[#1F1F1C]">
            سياسة عرض أسماء الإناث في الشجرة المنشورة
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FEMALE_DISPLAY_OPTIONS.map((opt) => {
              const active = femaleDisplayPolicy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeFemaleDisplayPolicy(opt.id)}
                  className={`rounded-xl px-3.5 py-2.5 border text-right transition-all cursor-pointer ${
                    active
                      ? 'bg-[#FDFBF7] border-[#D97757] ring-1 ring-[#D97757]/30'
                      : 'bg-[#FAF7F2] border-[#D8C7B2] hover:border-[#D97757]/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-display font-bold text-[#1F1F1C]">
                      {opt.title}
                    </span>
                    {active && (
                      <Check className="w-3.5 h-3.5 text-[#D97757] shrink-0" />
                    )}
                  </div>
                  <p className="text-[10.5px] text-[#1F1F1C]/70 mt-0.5 leading-relaxed">
                    {opt.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Toggle switches list — Strictly NO anonymous visitor enrichment */}
        <div className="divide-y divide-[#D8C7B2] rounded-xl border border-[#D8C7B2] bg-[#FAF7F2]">
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-display font-bold text-[#1F1F1C]">
                حجب أسماء الأحياء عن الزوار
              </div>
              <p className="text-[11px] text-[#1F1F1C]/70 mt-0.5">
                يُستبدل اسم الفرد الحي بوصف خصوصي للضيوف خارج دائرة العائلة
              </p>
            </div>
            <ModernSwitch
              checked={hideLivingNamesForGuests}
              onChange={onChangeHideLivingNamesForGuests}
              ariaLabel="حجب أسماء الأحياء عن الزوار"
            />
          </div>

          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-display font-bold text-[#1F1F1C]">
                إخفاء سنوات ميلاد الأحياء
              </div>
              <p className="text-[11px] text-[#1F1F1C]/70 mt-0.5">
                حماية تواريخ ميلاد أفراد العائلة الأحياء من الظهور في البوابة
                العامة
              </p>
            </div>
            <ModernSwitch
              checked={hideLivingBirthDates}
              onChange={onChangeHideLivingBirthDates}
              ariaLabel="إخفاء سنوات ميلاد الأحياء"
            />
          </div>

          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-display font-bold text-[#1F1F1C]">
                السماح لأفراد دائرة العائلة المخوّلين باقتراح إثراء الشجرة والخزانة
              </div>
              <p className="text-[11px] text-[#1F1F1C]/70 mt-0.5">
                يتيح لـ«راوي الذاكرة» إهداء صور للخزانة، ولـ«مساعد أمين السجل»
                اقتراح فروع للشجرة وإثراء الخزانة لمراجعتك
              </p>
            </div>
            <ModernSwitch
              checked={allowCircleMembersEnrichment}
              onChange={onChangeAllowCircleMembersEnrichment}
              ariaLabel="السماح لأفراد دائرة العائلة المخوّلين باقتراح إثراء الشجرة والخزانة"
            />
          </div>

          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-display font-bold text-[#1F1F1C]">
                تفعيل مشاركات وحوارات مجلس العائلة
              </div>
              <p className="text-[11px] text-[#1F1F1C]/70 mt-0.5">
                إتاحة قسم «مجلس العائلة ولوحة حراس الذاكرة» للنقاشات الأسبوعية
                وصلة الرحم
              </p>
            </div>
            <ModernSwitch
              checked={majlisEnabled}
              onChange={onChangeMajlisEnabled}
              ariaLabel="تفعيل مشاركات وحوارات مجلس العائلة"
            />
          </div>

          {isPublicMode && majlisEnabled && (
            <div className="px-4 py-3 flex items-center justify-between gap-3 bg-[#FDFBF7]">
              <div className="min-w-0">
                <div className="text-xs font-display font-bold text-[#1F1F1C]">
                  السماح لعموم الزوار بالمشاركة في المجلس والمناسبات
                </div>
                <p className="text-[11px] text-[#1F1F1C]/70 mt-0.5">
                  افتراضياً تقتصر الردود وتأكيد حضور المناسبات على أعضاء دائرة
                  العائلة المعتمدين فقط
                </p>
              </div>
              <ModernSwitch
                checked={allowPublicMajlis}
                onChange={onChangeAllowPublicMajlis}
                ariaLabel="السماح لعموم الزوار بالمشاركة في المجلس والمناسبات"
              />
            </div>
          )}
        </div>

        {/* Heritage privacy guarantee */}
        <div className="rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] px-3.5 py-2.5 flex items-center gap-2.5 text-[11px] text-[#1F1F1C]/80">
          <ShieldCheck className="w-4 h-4 text-[#D97757] shrink-0" />
          <span>
            تُحفظ سلسلة <strong>عمود نسبي</strong> التاريخية الموثقة بمعزل تام
            داخل لوحتك الخاصة ولا تُنشر للعامة؛ كما يُمنع نهائياً أي اقتراح
            مجهول الهوية على شجرة العائلة أو خزانتها.
          </span>
        </div>
      </section>
    </div>
  );
};
