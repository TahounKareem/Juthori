import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ExternalLink,
  GitBranch,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  KinshipCircleMember,
  KinshipCircleMemberRole,
  RecommendedRelativeCandidate,
} from '../services/priority4Service';
import { searchPlatformMembersLive } from '../services/priority4Service';
import {
  CIRCLE_PERMISSION_TIERS,
  normalizeCircleRoleKey,
} from '../utils/enrichmentStagingUtils';

const ROLE_OPTIONS: Array<{
  id: KinshipCircleMemberRole;
  labelAr: string;
  shortLabelAr: string;
}> = CIRCLE_PERMISSION_TIERS.map((tier) => ({
  id: tier.id,
  labelAr: tier.labelAr,
  shortLabelAr: tier.shortLabelAr,
}));

function getArabicInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ع';
  if (parts.length === 1) return parts[0].slice(0, 1);
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`;
}

function normalizeQuickSearch(raw?: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

interface MemberAvatarProps {
  name: string;
  avatarUrl?: string;
  isVerifiedActive?: boolean;
  size?: 'md' | 'lg';
}

const MemberAvatar: React.FC<MemberAvatarProps> = ({
  name,
  avatarUrl,
  isVerifiedActive = false,
  size = 'lg',
}) => {
  const dim = size === 'lg' ? 'w-16 h-16 text-lg' : 'w-12 h-12 text-sm';
  const dotSize = size === 'lg' ? 'w-4 h-4' : 'w-3 h-3';

  return (
    <div className={`relative inline-flex shrink-0 ${dim}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full rounded-full object-cover border-[3px] border-[#FDFBF7] ring-1 ring-[#D8C7B2] shadow-[0_3px_10px_rgba(31,31,28,0.08)]"
        />
      ) : (
        <div
          className={`w-full h-full rounded-full bg-gradient-to-br from-[#F5EFE4] to-[#E8DED2] border-[3px] border-[#FDFBF7] ring-1 ring-[#D8C7B2] text-[#D97757] font-display font-extrabold flex items-center justify-center shadow-[0_3px_10px_rgba(31,31,28,0.06)] ${
            size === 'lg' ? 'text-lg' : 'text-sm'
          }`}
        >
          {getArabicInitials(name)}
        </div>
      )}
      <span
        title={
          isVerifiedActive
            ? 'عضو موثق ونشط على منصة جذوري'
            : 'دعوة مرسلة بانتظار التفعيل'
        }
        className={`absolute bottom-0.5 right-0.5 ${dotSize} rounded-full border-2 border-[#FDFBF7] flex items-center justify-center ${
          isVerifiedActive ? 'bg-[#D97757]' : 'bg-[#D8C7B2]'
        }`}
      >
        {isVerifiedActive && (
          <Check className="w-2.5 h-2.5 text-[#FDFBF7] stroke-[3]" />
        )}
      </span>
    </div>
  );
};

// =============================================================================
// 1. RELATIVES YOU MAY KNOW (CAROUSEL / GRID)
// =============================================================================
export interface RelativesYouMayKnowSectionProps {
  familyName: string;
  candidates: RecommendedRelativeCandidate[];
  loading: boolean;
  addingCandidateId: string | null;
  recentlyAddedIds: Set<string>;
  onAddCandidate: (
    candidate: RecommendedRelativeCandidate,
    role: KinshipCircleMemberRole
  ) => void;
  onDismissCandidate: (candidateId: string) => void;
}

export const RelativesYouMayKnowSection: React.FC<
  RelativesYouMayKnowSectionProps
> = ({
  familyName,
  candidates,
  loading,
  addingCandidateId,
  recentlyAddedIds,
  onAddCandidate,
  onDismissCandidate,
}) => {
  const [roleByCandidate, setRoleByCandidate] = useState<
    Record<string, KinshipCircleMemberRole>
  >({});
  const [showAll, setShowAll] = useState(false);

  if (!loading && candidates.length === 0) {
    return null;
  }

  const visibleCandidates = showAll ? candidates : candidates.slice(0, 3);

  return (
    <section
      aria-label="أقارب وأبناء عمومة مقترحون لك على جذوري"
      className="rounded-2xl bg-gradient-to-l from-[#FAF6EE] via-[#FDFBF7] to-[#F5F1E8] border border-[#D8C7B2]/90 p-5 sm:p-6 shadow-[0_3px_18px_rgba(31,31,28,0.03)] space-y-4"
    >
      {/* Editorial Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] sm:text-base font-display font-extrabold text-[#1F1F1C] tracking-tight">
              أقارب وأبناء عمومة مقترحون لك على جذوري
            </h3>
            <p className="text-xs text-[#1F1F1C]/65 mt-0.5">
              أعضاء مسجلون يتقاطعون مع عائلة {familyName} في اللقب أو الفرع أو
              الموطن — ضمّهم لدائرتك بنقرة واحدة
            </p>
          </div>
        </div>

        {candidates.length > 3 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="px-3.5 py-1.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs font-display font-bold text-[#1F1F1C] transition-colors cursor-pointer shrink-0"
          >
            {showAll
              ? 'عرض أقل'
              : `عرض جميع المقترحات (${candidates.length})`}
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((k) => (
            <div
              key={k}
              className="rounded-2xl bg-[#FDFBF7] border border-[#D8C7B2]/60 p-5 space-y-3 animate-pulse"
            >
              <div className="w-16 h-16 rounded-full bg-[#E8DED2] mx-auto" />
              <div className="h-3.5 w-32 bg-[#E8DED2] rounded mx-auto" />
              <div className="h-3 w-44 bg-[#F5F1E8] rounded mx-auto" />
              <div className="h-9 w-full bg-[#E8DED2]/70 rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleCandidates.map((candidate) => {
            const selectedRole =
              roleByCandidate[candidate.userId] || 'memory_contributor';
            const isAdding = addingCandidateId === candidate.userId;
            const isJustAdded = recentlyAddedIds.has(candidate.userId);
            const locationLabel = [
              candidate.residenceCity || candidate.originRegion,
              candidate.originCountry,
            ]
              .filter(Boolean)
              .join('، ');

            return (
              <article
                key={candidate.userId}
                className="group rounded-2xl bg-[#FDFBF7] border border-[#D8C7B2]/90 hover:border-[#D97757]/60 shadow-[0_2px_12px_rgba(31,31,28,0.03)] hover:shadow-[0_6px_20px_rgba(31,31,28,0.06)] overflow-hidden flex flex-col justify-between transition-all"
              >
                <div>
                  {/* Soft Warm Heritage Band + Quiet Dismiss */}
                  <div className="relative h-14 bg-gradient-to-l from-[#E8DED2] via-[#EFE7DC] to-[#F5F1E8] border-b border-[#D8C7B2]/45">
                    <div className="pointer-events-none absolute top-0 right-0 w-24 h-[2px] bg-gradient-to-l from-[#D97757]/65 to-transparent" />
                    <button
                      type="button"
                      onClick={() => onDismissCandidate(candidate.userId)}
                      title="تجاهل هذا المقترح"
                      aria-label={`تجاهل ${candidate.fullName}`}
                      className="absolute top-2.5 left-2.5 w-7 h-7 rounded-full bg-[#FDFBF7]/80 hover:bg-[#FDFBF7] border border-[#D8C7B2]/70 text-[#1F1F1C]/50 hover:text-[#1F1F1C] flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Overlapping Large Avatar + Identity */}
                  <div className="px-4 pb-4 -mt-8 text-center flex flex-col items-center">
                    <MemberAvatar
                      name={candidate.fullName}
                      avatarUrl={candidate.avatarUrl}
                      isVerifiedActive={true}
                      size="lg"
                    />

                    <h4 className="mt-2.5 text-[15px] font-display font-extrabold text-[#1F1F1C] leading-snug line-clamp-1">
                      {candidate.fullName}
                    </h4>

                    <p className="mt-0.5 text-[11.5px] text-[#1F1F1C]/65 line-clamp-1">
                      {candidate.familyBranch || `عائلة ${candidate.familyName}`}
                      {locationLabel ? ` · ${locationLabel}` : ''}
                    </p>

                    {/* Smart Kinship Reason Cue */}
                    <div className="mt-3 w-full rounded-xl bg-[#FAF6EE] border border-[#D8C7B2]/65 px-3 py-2 text-right space-y-1">
                      <p className="text-[11px] font-semibold text-[#1F1F1C]/85 leading-relaxed line-clamp-2">
                        {candidate.primaryReasonAr}
                      </p>
                      <p className="text-[10.5px] text-[#D97757] font-display font-bold">
                        {candidate.mutualRelativesCount === 1
                          ? 'قريب مشترك واحد في نطاق العائلة'
                          : candidate.mutualRelativesCount === 2
                          ? 'قريبان مشتركان في نطاق العائلة'
                          : `${candidate.mutualRelativesCount} أقارب مشتركين في نطاق العائلة`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Role Picker + 1-Click Add Action */}
                <div className="px-4 pb-4 pt-2 border-t border-[#D8C7B2]/45 bg-[#FAF7F2]/60 space-y-2.5">
                  <div className="relative">
                    <select
                      aria-label={`صلاحية ${candidate.fullName}`}
                      value={selectedRole}
                      disabled={isAdding || isJustAdded}
                      onChange={(e) =>
                        setRoleByCandidate((prev) => ({
                          ...prev,
                          [candidate.userId]: e.target
                            .value as KinshipCircleMemberRole,
                        }))
                      }
                      className="w-full appearance-none pr-3 pl-8 py-1.5 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] focus:border-[#D97757] text-[11.5px] font-display font-bold text-[#1F1F1C] focus:outline-none cursor-pointer transition-colors"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          الصلاحية: {opt.shortLabelAr}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-[#D97757] pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>

                  <button
                    type="button"
                    disabled={isAdding || isJustAdded}
                    onClick={() => onAddCandidate(candidate, selectedRole)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isJustAdded
                        ? 'bg-[#E8DED2] text-[#1F1F1C] border border-[#D8C7B2]'
                        : 'bg-[#D97757] hover:bg-[#C46546] disabled:opacity-55 text-[#F5F1E8] shadow-[0_2px_10px_rgba(217,119,87,0.2)]'
                    }`}
                  >
                    {isJustAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#D97757]" />
                        <span>تم الضمّ لدائرة الأقارب ✓</span>
                      </>
                    ) : isAdding ? (
                      <span>جارٍ الضمّ والمزامنة...</span>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ ضمّ لدائرة الأقارب</span>
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

// =============================================================================
// 2. LIVE PLATFORM MEMBER SEARCH FIRST + EXPANDABLE EXTERNAL INVITE WING
// =============================================================================
export interface PlatformSearchFirstInviteWingProps {
  familyName: string;
  searchablePool: RecommendedRelativeCandidate[];
  excludedUids: Set<string>;
  addingCandidateId: string | null;
  recentlyAddedIds: Set<string>;
  externalInviteOpen: boolean;
  onToggleExternalInvite: () => void;
  onPrefillExternalInviteName: (typedName: string) => void;
  onAddPlatformCandidate: (
    candidate: RecommendedRelativeCandidate,
    role: KinshipCircleMemberRole
  ) => void;
  externalInviteForm: React.ReactNode;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export const PlatformSearchFirstInviteWing: React.FC<
  PlatformSearchFirstInviteWingProps
> = ({
  familyName,
  searchablePool,
  excludedUids,
  addingCandidateId,
  recentlyAddedIds,
  externalInviteOpen,
  onToggleExternalInvite,
  onPrefillExternalInviteName,
  onAddPlatformCandidate,
  externalInviteForm,
  containerRef,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchRoleByUid, setSearchRoleByUid] = useState<
    Record<string, KinshipCircleMemberRole>
  >({});

  const liveMatches = useMemo(
    () => searchPlatformMembersLive(searchQuery, searchablePool, excludedUids),
    [searchQuery, searchablePool, excludedUids]
  );

  const hasTypedQuery = searchQuery.trim().length > 0;

  return (
    <div
      ref={containerRef}
      className="rounded-2xl bg-gradient-to-l from-[#FAF6EE] via-[#FDFBF7] to-[#F5EFE4] border border-[#D8C7B2]/90 relative overflow-hidden shadow-[0_2px_14px_rgba(31,31,28,0.03)] transition-all"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-l from-[#D97757]/55 via-[#D8C7B2]/60 to-transparent" />

      {/* Primary Live Platform Search Area */}
      <div className="relative z-10 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
              <Search className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-display font-extrabold text-[#1F1F1C]">
                ابحث عن قريبك داخل جذوري أو أرسل دعوة جديدة
              </h3>
              <p className="text-xs text-[#1F1F1C]/65 mt-0.5">
                اعثر على أقاربك المسجلين بالاسم أو لقب العائلة أو المدينة وأضفهم
                فوراً دون الحاجة لكتابة بريد إلكتروني
              </p>
            </div>
          </div>
        </div>

        {/* Live Platform Search Input */}
        <div className="relative">
          <Search className="w-4.5 h-4.5 text-[#D97757] pointer-events-none absolute right-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`ابحث عن قريب مسجل في جذوري بالاسم، لقب عائلة ${familyName}، الفرع، أو المدينة...`}
            className="w-full pr-11 pl-10 py-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/15 text-xs sm:text-[13px] text-[#1F1F1C] placeholder:text-[#1F1F1C]/45 focus:outline-none transition-all shadow-[inset_0_1px_2px_rgba(31,31,28,0.03)]"
          />
          {hasTypedQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="مسح البحث"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-[#E8DED2] text-[#1F1F1C]/55 flex items-center justify-center cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Instant Platform Search Results */}
        {hasTypedQuery && (
          <div className="rounded-xl bg-[#FDFBF7] border border-[#D8C7B2]/80 divide-y divide-[#D8C7B2]/45 overflow-hidden">
            {liveMatches.length > 0 ? (
              liveMatches.map((member) => {
                const chosenRole =
                  searchRoleByUid[member.userId] || 'memory_contributor';
                const isAdding = addingCandidateId === member.userId;
                const isJustAdded = recentlyAddedIds.has(member.userId);
                const loc = [
                  member.residenceCity || member.originRegion,
                  member.originCountry,
                ]
                  .filter(Boolean)
                  .join('، ');

                return (
                  <div
                    key={member.userId}
                    className="p-3.5 sm:px-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[#FAF6EE]/70 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <MemberAvatar
                        name={member.fullName}
                        avatarUrl={member.avatarUrl}
                        isVerifiedActive={true}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="text-xs sm:text-[13.5px] font-display font-extrabold text-[#1F1F1C] truncate">
                          {member.fullName}
                        </div>
                        <div className="text-[11px] text-[#1F1F1C]/65 truncate mt-0.5">
                          {member.familyBranch || `عائلة ${member.familyName}`}
                          {member.tribeName ? ` · ${member.tribeName}` : ''}
                          {loc ? ` · ${loc}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                      <div className="relative w-full sm:w-40">
                        <select
                          aria-label={`اختيار صلاحية ${member.fullName}`}
                          value={chosenRole}
                          disabled={isAdding || isJustAdded}
                          onChange={(e) =>
                            setSearchRoleByUid((prev) => ({
                              ...prev,
                              [member.userId]: e.target
                                .value as KinshipCircleMemberRole,
                            }))
                          }
                          className="w-full appearance-none pr-3 pl-7 py-2 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] focus:border-[#D97757] text-[11px] font-display font-bold text-[#1F1F1C] focus:outline-none cursor-pointer"
                        >
                          {ROLE_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.shortLabelAr}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-[#D97757] pointer-events-none absolute left-2 top-1/2 -translate-y-1/2" />
                      </div>

                      <button
                        type="button"
                        disabled={isAdding || isJustAdded}
                        onClick={() =>
                          onAddPlatformCandidate(member, chosenRole)
                        }
                        className={`w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                          isJustAdded
                            ? 'bg-[#E8DED2] text-[#1F1F1C] border border-[#D8C7B2]'
                            : 'bg-[#D97757] hover:bg-[#C46546] disabled:opacity-55 text-[#F5F1E8]'
                        }`}
                      >
                        {isJustAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#D97757]" />
                            <span>تم الضمّ ✓</span>
                          </>
                        ) : isAdding ? (
                          <span>جارٍ الإضافة...</span>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>+ إرسال دعوة انضمام وصلاحية</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF6EE]/60">
                <p className="text-xs text-[#1F1F1C]/75">
                  لم نجد عضواً مسجلاً يطابق «
                  <span className="font-bold text-[#1F1F1C]">
                    {searchQuery.trim()}
                  </span>
                  » حالياً في دليل جذوري.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onPrefillExternalInviteName(searchQuery.trim());
                    if (!externalInviteOpen) onToggleExternalInvite();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>ادعُه بالبريد أو واتساب</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Secondary Smooth Toggle for External Email / WhatsApp Invitations */}
        <div className="pt-1 flex flex-wrap items-center justify-between gap-3 border-t border-[#D8C7B2]/50">
          <button
            type="button"
            onClick={onToggleExternalInvite}
            className="inline-flex items-center gap-2 text-xs font-display font-bold text-[#D97757] hover:text-[#B85C3E] transition-colors cursor-pointer py-1"
          >
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span>
              قريبك لم يسجل في جذوري بعد؟ أرسل له دعوة خارجية (بريد / واتساب)
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${
                externalInviteOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {externalInviteOpen && (
            <button
              type="button"
              onClick={onToggleExternalInvite}
              className="px-3 py-1 rounded-lg bg-[#E8DED2]/85 hover:bg-[#D8C7B2]/75 text-[11px] font-display font-bold text-[#1F1F1C] cursor-pointer transition-colors"
            >
              طي نموذج الدعوة الخارجية
            </button>
          )}
        </div>
      </div>

      {/* Expandable External Email/WhatsApp Form */}
      {externalInviteOpen && externalInviteForm}
    </div>
  );
};

// =============================================================================
// 3. FACEBOOK-INSPIRED LUXURY KINSHIP NETWORK GRID
// =============================================================================
type CircleFilterTab = 'all' | 'active' | 'contributors' | 'pending';

export interface SocialKinshipNetworkGridProps {
  familyName: string;
  members: KinshipCircleMember[];
  cleanMajlisUrl: string;
  contemporaryTreeOptions: Array<{
    id: string;
    label: string;
    relation?: string;
  }>;
  updatingMemberId: string | null;
  removingEmail: string | null;
  onUpdateMember: (
    member: KinshipCircleMember,
    patch: {
      role?: KinshipCircleMemberRole;
      linkedTreePersonId?: string | null;
      linkedTreePersonName?: string | null;
    }
  ) => void;
  onRemoveMember: (member: KinshipCircleMember) => void;
  onOpenExternalInvite: () => void;
}

export const SocialKinshipNetworkGrid: React.FC<
  SocialKinshipNetworkGridProps
> = ({
  familyName,
  members,
  cleanMajlisUrl,
  contemporaryTreeOptions,
  updatingMemberId,
  removingEmail,
  onUpdateMember,
  onRemoveMember,
  onOpenExternalInvite,
}) => {
  const [filterTab, setFilterTab] = useState<CircleFilterTab>('all');
  const [memberSearch, setMemberSearch] = useState('');
  const [openMenuMemberId, setOpenMenuMemberId] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenuMemberId) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node)
      ) {
        setOpenMenuMemberId(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [openMenuMemberId]);

  const counts = useMemo(() => {
    const active = members.filter((m) => m.status === 'ACTIVE').length;
    const contributors = members.filter((m) => {
      const r = normalizeCircleRoleKey(m.role);
      return r === 'assistant_registrar' || r === 'memory_contributor';
    }).length;
    const pending = members.filter((m) => m.status !== 'ACTIVE').length;
    return {
      all: members.length,
      active,
      contributors,
      pending,
    };
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = normalizeQuickSearch(memberSearch);
    return members.filter((m) => {
      if (filterTab === 'active' && m.status !== 'ACTIVE') return false;
      if (filterTab === 'pending' && m.status === 'ACTIVE') return false;
      if (filterTab === 'contributors') {
        const r = normalizeCircleRoleKey(m.role);
        if (r !== 'assistant_registrar' && r !== 'memory_contributor') return false;
      }
      if (!q) return true;
      const hay = normalizeQuickSearch(
        [
          m.name,
          m.kinshipRelation,
          m.familyBranch,
          m.residenceCity,
          m.residenceCountry,
          m.linkedTreePersonName,
          m.email,
        ]
          .filter(Boolean)
          .join(' ')
      );
      return hay.includes(q);
    });
  }, [members, filterTab, memberSearch]);

  const filterButtons: Array<{
    id: CircleFilterTab;
    label: string;
    count: number;
  }> = [
    { id: 'all', label: 'الكل', count: counts.all },
    { id: 'active', label: 'أعضاء نشطون على جذوري', count: counts.active },
    {
      id: 'contributors',
      label: 'مساعدو أمين السجل ورواة الذاكرة',
      count: counts.contributors,
    },
    { id: 'pending', label: 'دعوات بانتظار القبول', count: counts.pending },
  ];

  return (
    <section className="space-y-4">
      {/* Social Header & Interactive Filter Bar */}
      <div className="rounded-2xl bg-[#FAF7F2] border border-[#D8C7B2]/85 p-4 sm:p-5 space-y-3.5 shadow-[0_2px_10px_rgba(31,31,28,0.02)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
              <Users className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-display font-extrabold text-[#1F1F1C]">
                  أفراد دائرة عائلة {familyName} المعتمدون
                </h3>
                <span className="text-xs font-display font-bold text-[#D97757] tabular-nums">
                  ·{' '}
                  {members.length === 0
                    ? '0 أقارب'
                    : members.length === 1
                    ? 'قريب واحد'
                    : members.length === 2
                    ? 'قريبان'
                    : `${members.length} أقارب`}
                </span>
              </div>
              <p className="text-[11.5px] text-[#1F1F1C]/60">
                تتزامن الصلاحيات تلقائياً مع بوابة «موقعي» وحق المساهمة في الشجرة
                والخزانة
              </p>
            </div>
          </div>

          {members.length > 0 && (
            <div className="relative w-full md:w-64 shrink-0">
              <Search className="w-3.5 h-3.5 text-[#1F1F1C]/45 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="ابحث داخل دائرة العائلة..."
                className="w-full pr-9 pl-8 py-2 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] focus:border-[#D97757] text-xs text-[#1F1F1C] placeholder:text-[#1F1F1C]/45 focus:outline-none transition-colors"
              />
              {memberSearch && (
                <button
                  type="button"
                  onClick={() => setMemberSearch('')}
                  aria-label="مسح التصفية"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#1F1F1C]/45 hover:text-[#1F1F1C] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quick Interactive Filter Tabs */}
        {members.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#D8C7B2]/50"
            role="tablist"
            aria-label="تصفية أفراد الدائرة"
          >
            {filterButtons.map((btn) => {
              const isSelected = filterTab === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setFilterTab(btn.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#D97757] text-[#F5F1E8] shadow-2xs'
                      : 'bg-[#F5F1E8] text-[#1F1F1C]/80 border border-[#D8C7B2]/80 hover:bg-[#E8DED2]'
                  }`}
                >
                  <span>{btn.label}</span>
                  <span
                    className={`text-[10.5px] tabular-nums ${
                      isSelected ? 'text-[#F5F1E8]/85' : 'text-[#D97757]'
                    }`}
                  >
                    ({btn.count})
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Empty Circle State */}
      {members.length === 0 ? (
        <div className="rounded-2xl bg-gradient-to-l from-[#FAF6EE] via-[#FDFBF7] to-[#F5EFE4] border border-dashed border-[#D8C7B2] px-6 py-7 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-right">
            <div className="w-12 h-12 rounded-full bg-[#E8DED2] border-2 border-[#FDFBF7] ring-1 ring-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-sm font-display font-bold text-[#1F1F1C]">
                دائرة عائلة {familyName} جاهزة لاستقبال أول أفرادها
              </h4>
              <p className="text-xs text-[#1F1F1C]/65 leading-relaxed max-w-xl">
                ضمّ أقاربك المقترحين أعلاه بنقرة واحدة، أو ابحث عنهم في دليل
                جذوري، أو أرسل لهم دعوة خارجية عبر البريد أو واتساب.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenExternalInvite}
            className="px-4 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-2 cursor-pointer transition-colors shrink-0 shadow-[0_2px_10px_rgba(217,119,87,0.2)]"
          >
            <UserPlus className="w-4 h-4" />
            <span>دعوة قريب جديد</span>
          </button>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="rounded-2xl bg-[#FDFBF7] border border-[#D8C7B2]/80 px-6 py-8 text-center space-y-2">
          <p className="text-xs font-display font-bold text-[#1F1F1C]">
            لا توجد نتائج مطابقة لهذا التصنيف أو البحث
          </p>
          <button
            type="button"
            onClick={() => {
              setFilterTab('all');
              setMemberSearch('');
            }}
            className="px-3.5 py-1.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs font-display font-bold text-[#1F1F1C] cursor-pointer transition-colors"
          >
            إظهار جميع أفراد الدائرة ({members.length})
          </button>
        </div>
      ) : (
        /* Portrait Social Kinship Cards Grid */
        <div
          ref={menuContainerRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredMembers.map((member) => {
            const isActive = member.status === 'ACTIVE';
            const currentRole = normalizeCircleRoleKey(member.role);
            const isMenuOpen = openMenuMemberId === member.id;
            const locationText = [
              member.residenceCity,
              member.residenceCountry,
            ]
              .filter(Boolean)
              .join('، ');
            const memberWhatsappHref = `https://wa.me/?text=${encodeURIComponent(
              `السلام عليكم ${member.name}، يسعدنا تواجدك معنا في دائرة عائلة ${familyName} على منصة جذوري ✦\nرابط دخول بوابة العائلة:\n${cleanMajlisUrl}`
            )}`;
            const isSyntheticMemberEmail = member.email
              ?.toLowerCase()
              .endsWith('@member.juthori.com');

            return (
              <article
                key={member.id}
                className="rounded-2xl bg-[#FDFBF7] border border-[#D8C7B2]/90 hover:border-[#D97757]/55 shadow-[0_2px_14px_rgba(31,31,28,0.03)] hover:shadow-[0_6px_22px_rgba(31,31,28,0.06)] flex flex-col justify-between transition-all relative"
              >
                <div>
                  {/* Soft Decorative Top Band (#E8DED2) + Three-Dot Actions Menu */}
                  <div className="relative h-16 rounded-t-2xl bg-gradient-to-l from-[#E8DED2] via-[#EFE7DC] to-[#F5F1E8] border-b border-[#D8C7B2]/45">
                    <div className="pointer-events-none absolute top-0 right-0 w-24 h-[2px] rounded-tr-2xl bg-gradient-to-l from-[#D97757]/70 to-transparent" />

                    {/* Status Label Top-Right (Clean Unboxed Text) */}
                    <span className="absolute top-2.5 right-3.5 inline-flex items-center gap-1.5 text-[10.5px] font-display font-bold text-[#1F1F1C]/75">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isActive ? 'bg-[#D97757]' : 'bg-[#D8C7B2]'
                        }`}
                      />
                      {isActive ? 'عضو في جذوري' : 'بانتظار القبول'}
                    </span>

                    {/* Three-Dot Menu Button (⋯) Top-Left */}
                    <div className="absolute top-2 left-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuMemberId((prev) =>
                            prev === member.id ? null : member.id
                          )
                        }
                        aria-label={`خيارات إضافية لـ ${member.name}`}
                        className="w-8 h-8 rounded-full bg-[#FDFBF7]/85 hover:bg-[#FDFBF7] border border-[#D8C7B2]/80 text-[#1F1F1C]/70 hover:text-[#1F1F1C] flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {isMenuOpen && (
                        <div className="absolute left-0 top-9 z-30 w-64 rounded-2xl bg-[#FDFBF7] border border-[#D8C7B2] shadow-[0_12px_30px_rgba(31,31,28,0.12)] p-3 space-y-3 text-right">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-display font-bold text-[#1F1F1C] flex items-center gap-1.5">
                              <GitBranch className="w-3.5 h-3.5 text-[#D97757]" />
                              <span>الربط ببطاقة في «شجرتي»</span>
                            </label>
                            <div className="relative">
                              <select
                                value={member.linkedTreePersonId || ''}
                                disabled={
                                  updatingMemberId === member.id ||
                                  contemporaryTreeOptions.length === 0
                                }
                                onChange={(e) => {
                                  const selectedId = e.target.value;
                                  const found = contemporaryTreeOptions.find(
                                    (o) => o.id === selectedId
                                  );
                                  onUpdateMember(member, {
                                    linkedTreePersonId: selectedId || null,
                                    linkedTreePersonName: found?.label || null,
                                  });
                                  setOpenMenuMemberId(null);
                                }}
                                className="w-full appearance-none pr-3 pl-7 py-2 rounded-xl bg-[#FAF6EE] border border-[#D8C7B2] focus:border-[#D97757] text-[11px] font-semibold text-[#1F1F1C] focus:outline-none disabled:opacity-50 cursor-pointer"
                              >
                                <option value="">— غير مربوط بعد —</option>
                                {contemporaryTreeOptions.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 text-[#D97757] pointer-events-none absolute left-2 top-1/2 -translate-y-1/2" />
                            </div>
                          </div>

                          <div className="pt-2 border-t border-[#D8C7B2]/55">
                            <button
                              type="button"
                              disabled={removingEmail === member.email}
                              onClick={() => {
                                setOpenMenuMemberId(null);
                                onRemoveMember(member);
                              }}
                              className="w-full px-3 py-2 rounded-xl text-xs font-display font-bold text-[#D97757] hover:bg-[#D97757]/10 inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-45"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>إزالة القريب من الدائرة</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Overlapping Large Avatar & Clean Identity Block */}
                  <div className="px-4 pb-4 -mt-8 text-center flex flex-col items-center">
                    <MemberAvatar
                      name={member.name}
                      avatarUrl={member.avatarUrl}
                      isVerifiedActive={isActive}
                      size="lg"
                    />

                    <h4 className="mt-2.5 text-[15px] font-display font-extrabold text-[#1F1F1C] leading-snug line-clamp-1">
                      {member.name}
                    </h4>

                    {/* Kinship Relation & Branch Line */}
                    <p className="mt-0.5 text-xs font-semibold text-[#D97757] line-clamp-1">
                      {member.kinshipRelation}
                      {member.familyBranch ? ` · ${member.familyBranch}` : ''}
                    </p>

                    {/* Location & Social Context */}
                    <div className="mt-2 space-y-1 text-[11.5px] text-[#1F1F1C]/65 w-full">
                      {locationText ? (
                        <p className="inline-flex items-center justify-center gap-1 line-clamp-1">
                          <MapPin className="w-3 h-3 text-[#D97757]/80 shrink-0" />
                          <span>{locationText}</span>
                        </p>
                      ) : !isSyntheticMemberEmail && member.email ? (
                        <p
                          dir="ltr"
                          className="font-mono text-[11px] text-[#1F1F1C]/55 truncate"
                        >
                          {member.email}
                        </p>
                      ) : null}

                      <p className="text-[11px] text-[#1F1F1C]/70">
                        {typeof member.mutualRelativesCount === 'number' &&
                        member.mutualRelativesCount > 0
                          ? `${member.mutualRelativesCount} أقارب مشتركين في الدائرة`
                          : member.approvedEnrichmentsCount > 0
                          ? `${member.approvedEnrichmentsCount} مساهمة إثراء معتمدة`
                          : isActive
                          ? `نشط منذ ${new Date(
                              member.claimedAt || member.addedAt
                            ).toLocaleDateString('ar-SA')}`
                          : `أُرسلت الدعوة ${new Date(
                              member.addedAt
                            ).toLocaleDateString('ar-SA')}`}
                      </p>

                      {member.linkedTreePersonName && (
                        <p className="inline-flex items-center justify-center gap-1 text-[11px] text-[#1F1F1C]/75 bg-[#FAF6EE] border border-[#D8C7B2]/60 rounded-lg px-2.5 py-0.5 mt-1">
                          <UserCheck className="w-3 h-3 text-[#D97757] shrink-0" />
                          <span className="truncate">
                            شجرتي: {member.linkedTreePersonName}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Uncluttered Bottom Control Bar */}
                <div className="px-4 py-3.5 rounded-b-2xl border-t border-[#D8C7B2]/50 bg-[#FAF7F2]/75 space-y-2.5">
                  <div className="relative">
                    <select
                      aria-label={`مستوى صلاحية ${member.name}`}
                      value={currentRole}
                      disabled={updatingMemberId === member.id}
                      onChange={(e) =>
                        onUpdateMember(member, {
                          role: e.target.value as KinshipCircleMemberRole,
                        })
                      }
                      className="w-full appearance-none pr-3 pl-8 py-2 rounded-xl bg-[#FDFBF7] hover:bg-[#F5F1E8] border border-[#D8C7B2] focus:border-[#D97757] text-xs font-display font-bold text-[#1F1F1C] focus:outline-none disabled:opacity-50 cursor-pointer transition-colors"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.shortLabelAr}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-[#D97757] pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>

                  {member.publishedSiteSlug ? (
                    <a
                      href={`/${member.publishedSiteSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 px-3 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 transition-colors shadow-[0_2px_8px_rgba(217,119,87,0.16)]"
                    >
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      <span>زيارة ديوانه العائلي</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <a
                      href={memberWhatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 px-3 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-[#D97757] shrink-0" />
                      <span>
                        {isActive
                          ? 'مراسلة عبر واتساب'
                          : 'إرسال تذكير واتساب'}
                      </span>
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
