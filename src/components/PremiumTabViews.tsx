import React from 'react';
import {
  BookOpen,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import {
  AccountLegalType,
  AncestorCapsule,
  DashboardAccessCapabilities,
  DashboardTab,
  LineageSearchResult,
} from '../types/juthori';
import { InteractiveFamilyTreeBuilder } from './InteractiveFamilyTreeBuilder';
import { FamilyMemoryVaultView } from './FamilyMemoryVaultView';
import { MySiteStudioView } from './MySiteStudioView';
import { CommunityHubView } from './CommunityHubView';
import {
  CustomerCommunityPostData,
  CustomerSiteSettingsData,
} from '../services/firestoreService';

interface PremiumTabViewsProps {
  activeTab: DashboardTab;
  result: LineageSearchResult;
  accountType: AccountLegalType;
  caps: DashboardAccessCapabilities;
  onNavigateTab: (tab: DashboardTab) => void;
  onUnlockRoot5Usd: () => void;
  onUpgradeAnnualVip: () => void;
  onSignCharterAndEnableTree: () => void;
  onLogActivity: (action: string, detail: string) => void;
  onSyncImmediateParents?: (fatherName: string, grandfatherName: string) => void;
  unlockedCapsules?: string[];
  onRequestUnlockCapsule?: (capsule: AncestorCapsule) => void;
  onRequestUnlockAllCapsulesBundle?: () => void;
  walletBalance?: number;
  userAvatarUrl?: string;
  userId?: string;
  userEmail?: string;
  initialSiteSettings?: CustomerSiteSettingsData;
  onSaveSiteSettings?: (settings: CustomerSiteSettingsData) => void;
  initialCommunityPosts?: CustomerCommunityPostData[];
  onSaveCommunityPosts?: (posts: CustomerCommunityPostData[]) => void;
  emailVerified?: boolean;
  onOpenEmailVerification?: () => void;
  initialVaultPersonFilterId?: string | null;
  onConsumeVaultPersonFilterId?: () => void;
  onOpenVaultForPerson?: (personId: string) => void;
  onRequestReferenceCorrectionTicket?: (
    personName: string,
    referenceRank?: string
  ) => void;
  blockedUserIds?: string[];
  onBlockCommunityUser?: (targetUserId: string, targetUserName: string) => void;
}

export const PremiumTabViews: React.FC<PremiumTabViewsProps> = ({
  activeTab,
  result,
  accountType,
  caps,
  onNavigateTab,
  onUnlockRoot5Usd,
  onUpgradeAnnualVip,
  onSignCharterAndEnableTree,
  onLogActivity,
  onSyncImmediateParents,
  unlockedCapsules = [],
  onRequestUnlockCapsule,
  onRequestUnlockAllCapsulesBundle,
  walletBalance = 0,
  userAvatarUrl,
  userId,
  userEmail,
  initialSiteSettings,
  onSaveSiteSettings,
  emailVerified = true,
  onOpenEmailVerification,
  initialVaultPersonFilterId = null,
  onConsumeVaultPersonFilterId,
  onOpenVaultForPerson,
  onRequestReferenceCorrectionTicket,
  blockedUserIds = [],
  onBlockCommunityUser,
}) => {

  if (activeTab === DashboardTab.Home) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#D8755B]">
              ملخص الحساب العائلي · {caps.isVip ? 'باقة بريميوم السنوية' : 'الباقة الأساسية (البيسك)'}
            </div>
            <h2 className="text-2xl font-display font-bold text-[#252321]">
              مرحباً بك يا {result.clientName} في سجل عائلة {result.familyName}
            </h2>
            <p className="text-sm text-[#252321]/75 max-w-2xl leading-relaxed">
              الصفة القانونية الحالية:{' '}
              <strong className="text-[#252321]">
                {accountType === AccountLegalType.RecordKeeper
                  ? 'رب أسرة - أمين السجل (مخوّل ببناء الشجرة)'
                  : 'حساب فرد (مستكشف للنسب)'}
              </strong>{' '}
              · موطن الأصل المسجل: <strong className="text-[#252321]">{result.originCountry}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab(DashboardTab.Lineage)}
              className="px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-sm font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>استعراض عمود نسبي</span>
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            {!caps.isVip && (
              <button
                type="button"
                onClick={onUpgradeAnnualVip}
                className="px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-sm font-display font-bold transition-colors cursor-pointer"
              >
                ترقية إلى بريميوم السنوي
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="rounded-2xl bg-white border border-[#B98A78]/35 p-5">
            <div className="text-xs text-[#252321]/65 mb-1">حالة نقطة الربط (الجذر)</div>
            <div className="text-lg font-display font-bold text-[#252321] mb-2">
              {caps.isRootUnlocked
                ? `${result.rootBranchName} — ${result.rootTribeName}`
                : 'مقفلة ($5 لفتح الجذر)'}
            </div>
            {!caps.isRootUnlocked && caps.isMatched && (
              <button
                type="button"
                onClick={onUnlockRoot5Usd}
                className="text-xs font-semibold text-[#D8755B] hover:underline cursor-pointer"
              >
                افتح الجذر الآن مقابل $5 ←
              </button>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-[#B98A78]/35 p-5">
            <div className="text-xs text-[#252321]/65 mb-1">عمود النسب الأعلى والمصادر</div>
            <div className="text-lg font-display font-bold text-[#252321] mb-2">
              {caps.areUpperAncestorsUnlocked
                ? 'مفتوح بالكامل (8 طبقات عليا حتى أدد)'
                : 'مقفل (يتطلب اشتراك بريميوم)'}
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab(DashboardTab.Lineage)}
              className="text-xs font-semibold text-[#D8755B] hover:underline cursor-pointer"
            >
              معاينة العمود التفصيلي ←
            </button>
          </div>

          <div className="rounded-2xl bg-white border border-[#B98A78]/35 p-5">
            <div className="text-xs text-[#252321]/65 mb-1">صلاحية شجرة العائلة (شجرتي)</div>
            <div className="text-lg font-display font-bold text-[#252321] mb-2">
              {caps.maxTreeMembers === null
                ? 'سعة مفتوحة · أمين سجل العائلة ✦'
                : `مفعّلة حتى ${caps.maxTreeMembers} فرداً`}
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab(DashboardTab.MyTree)}
              className="text-xs font-semibold text-[#D8755B] hover:underline cursor-pointer"
            >
              الدخول إلى شجرتي ←
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === DashboardTab.MyTree) {
    return (
      <InteractiveFamilyTreeBuilder
        result={result}
        accountType={accountType}
        caps={caps}
        onUnlockRoot5Usd={onUnlockRoot5Usd}
        onUpgradeAnnualVip={onUpgradeAnnualVip}
        onSignCharterAndEnableTree={onSignCharterAndEnableTree}
        onLogActivity={onLogActivity}
        onSyncImmediateParents={onSyncImmediateParents}
        unlockedCapsules={unlockedCapsules}
        onRequestUnlockCapsule={onRequestUnlockCapsule}
        onRequestUnlockAllCapsulesBundle={onRequestUnlockAllCapsulesBundle}
        walletBalance={walletBalance}
        userAvatarUrl={userAvatarUrl}
        userId={userId}
        userEmail={userEmail}
        onOpenVaultForPerson={onOpenVaultForPerson}
        onRequestReferenceCorrectionTicket={onRequestReferenceCorrectionTicket}
      />
    );
  }

  if (activeTab === DashboardTab.MyVault) {
    return (
      <FamilyMemoryVaultView
        result={result}
        caps={caps}
        userId={userId}
        userEmail={userEmail}
        userAvatarUrl={userAvatarUrl}
        initialSelectedPersonId={initialVaultPersonFilterId}
        onConsumeSelectedPersonId={onConsumeVaultPersonFilterId}
        onLogActivity={onLogActivity}
        onNavigateTab={onNavigateTab}
        onUnlockRoot5Usd={onUnlockRoot5Usd}
        onUpgradeAnnualVip={onUpgradeAnnualVip}
        onSignCharterAndEnableTree={onSignCharterAndEnableTree}
      />
    );
  }

  if (activeTab === DashboardTab.MyExplorer) {
    return (
      <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 sm:p-8 space-y-6">
        <div className="border-b border-[#B98A78]/25 pb-5">
          <div className="text-xs font-semibold text-[#D8755B] mb-1">
            كشافي · الاكتشاف والإثراء ومقارنة الروايات
          </div>
          <h2 className="text-xl sm:text-2xl font-display font-bold text-[#252321]">
            تحليل المصادر والروايات التاريخية لـ {result.familyName}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/40 p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-display font-bold text-[#252321]">
              <BookOpen className="w-4 h-4 text-[#8D4925]" aria-hidden="true" />
              <span>دراسة اتساق وتعارض الروايات النسبية</span>
            </div>
            <p className="text-sm text-[#252321]/85 leading-relaxed">
              {result.conflictingNarrativesNote}
            </p>
            <div className="pt-2 text-xs text-[#8D4925] font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#D8755B]" aria-hidden="true" />
              <span>درجة التوثيق المصدري: إجماع المشجرات المحلية وأمهات كتب النسب</span>
            </div>
          </div>

          <div className="rounded-2xl bg-[#EDE6DA]/65 border border-[#B98A78]/40 p-5 space-y-3">
            <div className="text-sm font-display font-bold text-[#252321]">
              النطاق الجغرافي التاريخي والهجرات
            </div>
            <p className="text-sm text-[#252321]/85 leading-relaxed">
              الموطن التاريخي الأصيل: <strong>{result.historicalRegion}</strong>، مع امتداد حواضر الأسرة المعاصرة في {result.originCountry}.
            </p>
            <div className="text-xs text-[#252321]/70">
              المصدر المحوري: «{result.verifiedSourceCitation}»
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === DashboardTab.MySite) {
    return (
      <MySiteStudioView
        result={result}
        accountType={accountType}
        caps={caps}
        unlockedCapsules={unlockedCapsules}
        userId={userId}
        userEmail={userEmail}
        emailVerified={emailVerified}
        initialSiteSettings={initialSiteSettings}
        onSaveSiteSettings={onSaveSiteSettings}
        onUpgradeAnnualVip={onUpgradeAnnualVip}
        onSignCharterAndEnableTree={onSignCharterAndEnableTree}
        onOpenEmailVerification={onOpenEmailVerification}
        onLogActivity={onLogActivity}
      />
    );
  }

  return (
    <CommunityHubView
      result={result}
      accountType={accountType}
      caps={caps}
      userId={userId}
      userEmail={userEmail}
      publishedSiteSlug={initialSiteSettings?.siteSubdomain}
      blockedUserIds={blockedUserIds}
      onBlockUser={(targetUid, targetName) =>
        onBlockCommunityUser?.(targetUid, targetName)
      }
      onNavigateTab={onNavigateTab}
      onSignCharterAndEnableTree={onSignCharterAndEnableTree}
      onLogActivity={onLogActivity}
    />
  );
};
