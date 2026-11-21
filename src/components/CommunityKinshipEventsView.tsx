import React, { useMemo } from 'react';
import {
  ArrowUpLeft,
  Award,
  Calendar,
  CheckCircle2,
  GitBranch,
  HeartHandshake,
  MapPin,
  Share2,
  Trees,
  Users,
  XCircle,
} from 'lucide-react';
import {
  KinshipCircleDoc,
  PublicMicrositeData,
  RawTreePersonForPublicProjection,
  computeContemporaryTreeMetrics,
} from '../services/priority4Service';
import { DashboardTab } from '../types/juthori';

interface CommunityKinshipEventsViewProps {
  familyName: string;
  activeSiteSlug?: string;
  ownerMicrosite: PublicMicrositeData | null;
  circle: KinshipCircleDoc;
  rawTreeMembers: RawTreePersonForPublicProjection[];
  onNavigateTab?: (tab: DashboardTab) => void;
}

export const CommunityKinshipEventsView: React.FC<
  CommunityKinshipEventsViewProps
> = ({
  familyName,
  activeSiteSlug,
  ownerMicrosite,
  circle,
  rawTreeMembers,
  onNavigateTab,
}) => {
  const realEvents = useMemo(
    () => ownerMicrosite?.cmsModules?.eventsModule?.items || [],
    [ownerMicrosite]
  );

  const realGuardians = useMemo(
    () =>
      [...(circle.members || [])]
        .filter((m) => (m.approvedEnrichmentsCount || 0) > 0)
        .sort(
          (a, b) =>
            (b.approvedEnrichmentsCount || 0) -
            (a.approvedEnrichmentsCount || 0)
        ),
    [circle.members]
  );

  const treePulse = useMemo(() => {
    const contemporary = (rawTreeMembers || []).filter(
      (n) => n && n.isCertifiedReference !== true
    );
    const metrics = computeContemporaryTreeMetrics(contemporary, familyName);
    let deceasedCount = 0;
    for (const n of contemporary) {
      const isDec =
        Boolean(n.isDeceased) ||
        String(n.vitalStatus || '') === 'deceased' ||
        Boolean(n.deathYear) ||
        Boolean(n.deathDateValue) ||
        n.isAlive === false;
      if (isDec) deceasedCount += 1;
    }
    const livingCount = Math.max(0, contemporary.length - deceasedCount);
    return {
      ...metrics,
      livingCount,
      deceasedCount,
    };
  }, [rawTreeMembers, familyName]);

  const cleanPortalUrl = activeSiteSlug
    ? `https://juthori.com/${activeSiteSlug}`
    : 'https://juthori.com';

  const formatCountdownLabel = (isoDate: string): {
    label: string;
    isPast: boolean;
  } => {
    const targetMs = new Date(isoDate).getTime();
    if (!Number.isFinite(targetMs)) {
      return { label: 'موعد محدد في البوابة', isPast: false };
    }
    const diffDays = Math.ceil((targetMs - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: 'مناسبة سابقة', isPast: true };
    if (diffDays === 0) return { label: 'اليوم ✦', isPast: false };
    if (diffDays === 1) return { label: 'غداً', isPast: false };
    return { label: `متبقي ${diffDays} يوماً`, isPast: false };
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Real Family Events & RSVP Tracker (Wired to «موقعي») */}
      <div className="rounded-2xl bg-white border border-[#B98A78]/35 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#B98A78]/25 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F7F2E9] text-[#8D4925] flex items-center justify-center shrink-0">
              <Calendar className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-display font-bold text-[#252321]">
                متابعة مناسبات الأسرة وتأكيد الحضور (RSVP)
              </h3>
              <p className="text-[11px] text-[#252321]/60">
                مرتبطة لحظياً بالمناسبات المسجّلة في بوابة أسرة {familyName} «موقعي»
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab?.(DashboardTab.MySite)}
            className="px-3.5 py-2 rounded-xl bg-[#FAF6EE] hover:bg-[#EFE7DA] border border-[#B98A78]/35 text-xs font-display font-bold text-[#8D4925] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>إدارة المناسبات في «موقعي»</span>
            <ArrowUpLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-6">
          {realEvents.length === 0 ? (
            <div className="rounded-2xl bg-[#FAF6EE] border border-dashed border-[#B98A78]/50 p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white border border-[#B98A78]/30 mx-auto flex items-center justify-center text-[#8D4925]">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="text-sm font-display font-bold text-[#252321]">
                  لا توجد مناسبات عائلية مجدولة حالياً
                </h4>
                <p className="text-xs text-[#252321]/65 leading-relaxed">
                  أضف ملتقى العائلة السنوي، أو مأدبة عيد، أو اجتماع صلة الرحم عبر قسم المناسبات في «موقعي» ليتمكن أقاربك من تأكيد حضورهم ومتابعة الأعداد هنا تلقائياً.
                </p>
              </div>
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab(DashboardTab.MySite)}
                  className="mt-1 px-5 py-2.5 rounded-xl bg-[#252321] hover:bg-[#3a3633] text-[#F7F2E9] text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span>إضافة أول مناسبة في «موقعي»</span>
                  <ArrowUpLeft className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {realEvents.map((ev) => {
                const rsvps = Array.isArray(ev.rsvps) ? ev.rsvps : [];
                const attending = rsvps.filter((r) => r.status === 'attending');
                const apologizing = rsvps.filter(
                  (r) => r.status === 'apologizing'
                );
                const totalGuests = attending.reduce(
                  (sum, r) => sum + 1 + Number(r.companionsCount || 0),
                  0
                );
                const countdown = formatCountdownLabel(ev.eventDateIso);
                const dateFormatted = ev.eventDateIso
                  ? new Date(ev.eventDateIso).toLocaleDateString('ar-SA', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'تاريخ غير محدد';

                const whatsappEventText = `السلام عليكم أحبتي أبناء أسرة ${familyName} الكرام ✦\nتذكير بمناسبة: «${ev.title}»\nالتاريخ: ${dateFormatted}\nالموقع: ${ev.locationLabel || 'يُحدد عبر البوابة'}\n${
                  ev.hostNote ? `ملاحظة الداعي: ${ev.hostNote}\n` : ''
                }يرجى تأكيد حضوركم وعدد المرافقين عبر بوابة الأسرة:\n${cleanPortalUrl}`;

                return (
                  <div
                    key={ev.id}
                    className="rounded-2xl bg-[#FAF6EE] border border-[#B98A78]/35 p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <h4 className="text-base font-display font-bold text-[#252321] leading-snug">
                            {ev.title}
                          </h4>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#252321]/70">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-[#8D4925]" />
                              {dateFormatted}
                            </span>
                            {ev.locationLabel && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-[#8D4925]" />
                                {ev.locationLabel}
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-display font-bold tabular-nums ${
                            countdown.isPast
                              ? 'bg-[#252321]/10 text-[#252321]/65'
                              : 'bg-[#D8755B]/15 text-[#8D4925]'
                          }`}
                        >
                          {countdown.label}
                        </span>
                      </div>

                      {ev.hostNote && (
                        <p className="text-xs text-[#252321]/70 bg-white/80 rounded-xl px-3.5 py-2.5 border border-[#B98A78]/20">
                          {ev.hostNote}
                        </p>
                      )}

                      {/* Real RSVP Breakdown */}
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <div className="rounded-xl bg-white border border-[#B98A78]/25 px-3 py-2.5 text-center">
                          <div className="text-[10px] text-[#252321]/60">
                            مؤكدون للحضور
                          </div>
                          <div className="text-lg font-display font-bold text-emerald-800 tabular-nums mt-0.5">
                            {attending.length}
                          </div>
                        </div>
                        <div className="rounded-xl bg-white border border-[#B98A78]/25 px-3 py-2.5 text-center">
                          <div className="text-[10px] text-[#252321]/60">
                            إجمالي الضيوف
                          </div>
                          <div className="text-lg font-display font-bold text-[#252321] tabular-nums mt-0.5">
                            {totalGuests}
                          </div>
                        </div>
                        <div className="rounded-xl bg-white border border-[#B98A78]/25 px-3 py-2.5 text-center">
                          <div className="text-[10px] text-[#252321]/60">
                            معتذرون
                          </div>
                          <div className="text-lg font-display font-bold text-[#8D4925] tabular-nums mt-0.5">
                            {apologizing.length}
                          </div>
                        </div>
                      </div>

                      {/* Real Attendee Names List */}
                      {rsvps.length > 0 ? (
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[11px] font-semibold text-[#252321]/65">
                            أحدث ردود الحضور المسجّلة:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {rsvps.slice(0, 10).map((r) => (
                              <span
                                key={r.id}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                                  r.status === 'attending'
                                    ? 'bg-emerald-900/5 border-emerald-900/15 text-emerald-950'
                                    : 'bg-amber-900/5 border-amber-900/15 text-[#8D4925]'
                                }`}
                              >
                                {r.status === 'attending' ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-[#8D4925]" />
                                )}
                                <span>{r.attendeeName}</span>
                                {r.status === 'attending' &&
                                  Number(r.companionsCount || 0) > 0 && (
                                    <span className="text-[10px] opacity-75 tabular-nums">
                                      (+{r.companionsCount})
                                    </span>
                                  )}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-[#252321]/55 italic">
                          لم تُسجّل تأكيدات حضور لهذه المناسبة بعد. شارك التذكير عبر واتساب لتحفيز الأقارب.
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[#B98A78]/20 flex items-center justify-between gap-2">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          whatsappEventText
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full px-4 py-2.5 rounded-xl bg-[#1F6E43] hover:bg-[#195a36] text-white text-xs font-display font-bold inline-flex items-center justify-center gap-2 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>مشاركة تذكير المناسبة عبر واتساب</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Memory Guardians Honor Roll & Live Tree Kinship Pulse */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Memory Guardians Honor Roll */}
        <div className="rounded-2xl bg-white border border-[#B98A78]/35 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-[#B98A78]/25 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Award className="w-4.5 h-4.5 text-[#D8755B]" />
              <h3 className="text-sm font-display font-bold text-[#252321]">
                لوحة شرف «حماة الذاكرة»
              </h3>
            </div>
            <span className="text-[11px] text-[#252321]/60 tabular-nums">
              {realGuardians.length} مساهم معتمد
            </span>
          </div>

          <div className="p-6 flex-1">
            {realGuardians.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-6 space-y-2.5">
                <div className="w-11 h-11 rounded-2xl bg-[#FAF6EE] border border-[#B98A78]/30 flex items-center justify-center text-[#8D4925]">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <div className="text-xs font-display font-bold text-[#252321]">
                  بانتظار أول مساهمة معتمدة من الأسرة
                </div>
                <p className="text-[11px] text-[#252321]/60 max-w-sm leading-relaxed">
                  عند اعتمادك لأي مقترح إضافة فرد أو صورة تاريخية من قريبك في «مركز الإثراء»، يتصدّر اسمه تلقائياً لوحة شرف حماة الذاكرة هنا وفي موقع العائلة.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {realGuardians.slice(0, 8).map((member, idx) => {
                  const rankColors =
                    idx === 0
                      ? 'bg-[#D4AF6A]/20 text-[#8D4925] border-[#D4AF6A]/50'
                      : idx === 1
                      ? 'bg-stone-200/70 text-stone-700 border-stone-300'
                      : idx === 2
                      ? 'bg-amber-900/10 text-[#8D4925] border-amber-900/20'
                      : 'bg-[#F7F2E9] text-[#252321]/70 border-[#B98A78]/30';
                  return (
                    <div
                      key={member.id}
                      className="rounded-xl bg-[#FAF6EE] border border-[#B98A78]/25 px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg border font-display font-bold text-xs flex items-center justify-center shrink-0 tabular-nums ${rankColors}`}
                        >
                          #{idx + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-display font-bold text-[#252321] truncate">
                            {member.name}
                          </div>
                          <div className="text-[11px] text-[#252321]/60 truncate">
                            {member.kinshipRelation}
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 px-2.5 py-1 rounded-lg bg-white border border-[#B98A78]/30 text-[11px] font-display font-bold text-[#8D4925] tabular-nums">
                        {member.approvedEnrichmentsCount} إثراء معتمد
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Real Family Tree Kinship Pulse */}
        <div className="rounded-2xl bg-white border border-[#B98A78]/35 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-[#B98A78]/25 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Trees className="w-4.5 h-4.5 text-[#8D4925]" />
              <h3 className="text-sm font-display font-bold text-[#252321]">
                نبض الأجيال والفروع الفعلي في «شجرتي»
              </h3>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab(DashboardTab.MyTree)}
                className="text-[11px] font-display font-bold text-[#8D4925] hover:underline cursor-pointer"
              >
                فتح شجرتي ←
              </button>
            )}
          </div>

          <div className="p-6 flex-1 space-y-5">
            {treePulse.totalContemporaryMembers === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-6 space-y-2.5">
                <div className="w-11 h-11 rounded-2xl bg-[#FAF6EE] border border-[#B98A78]/30 flex items-center justify-center text-[#8D4925]">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div className="text-xs font-display font-bold text-[#252321]">
                  شجرة الأسرة المعاصرة بانتظار التدوين
                </div>
                <p className="text-[11px] text-[#252321]/60 max-w-sm leading-relaxed">
                  بمجرد إضافة أفراد أسرتك المعاصرين في «شجرتي»، تظهر هنا إحصائيات الأجيال والفروع والأسماء الأكثر تداولاً تلقائياً.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-[#FAF6EE] border border-[#B98A78]/25 p-3.5 text-center">
                    <div className="text-[11px] text-[#252321]/60">
                      أفراد الأسرة
                    </div>
                    <div className="text-2xl font-display font-bold text-[#252321] tabular-nums mt-0.5">
                      {treePulse.totalContemporaryMembers}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#FAF6EE] border border-[#B98A78]/25 p-3.5 text-center">
                    <div className="text-[11px] text-[#252321]/60">
                      طبقات الأجيال
                    </div>
                    <div className="text-2xl font-display font-bold text-[#8D4925] tabular-nums mt-0.5">
                      {treePulse.generationsCount}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#FAF6EE] border border-[#B98A78]/25 p-3.5 text-center">
                    <div className="text-[11px] text-[#252321]/60">
                      الأحياء · الراحلون
                    </div>
                    <div className="text-lg font-display font-bold text-[#252321] tabular-nums mt-1">
                      {treePulse.livingCount}{' '}
                      <span className="text-[#252321]/30">·</span>{' '}
                      <span className="text-[#8D4925]">
                        {treePulse.deceasedCount}
                      </span>
                    </div>
                  </div>
                </div>

                {treePulse.largestBranches.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-display font-bold text-[#252321] flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#8D4925]" />
                      <span>أبرز فروع الأسرة المدوّنة</span>
                    </div>
                    <div className="space-y-1.5">
                      {treePulse.largestBranches.slice(0, 4).map((branch) => {
                        const pct = Math.min(
                          100,
                          Math.max(
                            12,
                            Math.round(
                              (branch.count /
                                Math.max(1, treePulse.totalContemporaryMembers)) *
                                100
                            )
                          )
                        );
                        return (
                          <div key={branch.branchLabel} className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-[#252321]">
                                {branch.branchLabel}
                              </span>
                              <span className="text-[#8D4925] font-bold tabular-nums">
                                {branch.count} فرد
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[#F7F2E9] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#D8755B]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {treePulse.topCommonNames.length > 0 && (
                  <div className="pt-1 border-t border-[#B98A78]/20 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-semibold text-[#252321]/65">
                      الأسماء المتكررة في الأسرة:
                    </span>
                    {treePulse.topCommonNames.slice(0, 5).map((item) => (
                      <span
                        key={item.name}
                        className="px-2.5 py-0.5 rounded-lg bg-[#FAF6EE] border border-[#B98A78]/30 text-[#252321] font-medium tabular-nums"
                      >
                        {item.name} ({item.count})
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
