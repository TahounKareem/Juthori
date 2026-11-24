import React from 'react';
import {
  AccountLegalType,
  AncestorCapsule,
  DashboardAccessCapabilities,
  DashboardTab,
  LineageSearchResult,
  NotificationItem,
} from '../types/juthori';
import { CustomerHomeOverview } from './CustomerHomeOverview';
import { InteractiveFamilyTreeBuilder } from './InteractiveFamilyTreeBuilder';
import { FamilyMemoryVaultView } from './FamilyMemoryVaultView';
import { MySiteStudioView } from './MySiteStudioView';
import { CommunityHubView } from './CommunityHubView';
import { RoyalPremiumFeatureGate } from './RoyalPremiumFeatureGate';
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
  unlockedAddonSourceIds?: string[];
  onRequestUnlockCapsule?: (capsule: AncestorCapsule) => void;
  onRequestUnlockAllCapsulesBundle?: () => void;
  walletBalance?: number;
  extraTreeCapacity?: number;
  onPurchaseExtraTreeCapacity?: (
    extraSlots: number,
    priceUsd: number
  ) => Promise<{
    ok: boolean;
    shortfallUsd?: number;
    balanceAfter?: number;
    errorMessage?: string;
  }>;
  userAvatarUrl?: string;
  userId?: string;
  userEmail?: string;
  userPhone?: string;
  dashboardNotifications?: NotificationItem[];
  onOpenWalletDrawer?: () => void;
  onOpenNotificationsDrawer?: () => void;
  onOpenFullResearchTickets?: () => void;
  onAdoptResolvedLineage?: (enrichedResult: LineageSearchResult) => void;
  onTicketsStatusChange?: (status: {
    hasAnyTicket: boolean;
    hasResearcherReplyWaiting: boolean;
  }) => void;
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
  unlockedAddonSourceIds = [],
  onRequestUnlockCapsule,
  onRequestUnlockAllCapsulesBundle,
  walletBalance = 0,
  extraTreeCapacity = 0,
  onPurchaseExtraTreeCapacity,
  userAvatarUrl,
  userId,
  userEmail = '',
  userPhone = '',
  dashboardNotifications = [],
  onOpenWalletDrawer = () => {},
  onOpenNotificationsDrawer = () => {},
  onOpenFullResearchTickets = () => {},
  onAdoptResolvedLineage,
  onTicketsStatusChange,
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
  const [openTreeSettingsOnMount, setOpenTreeSettingsOnMount] =
    React.useState(false);

  if (activeTab === DashboardTab.Home) {
    return (
      <CustomerHomeOverview
        result={result}
        accountType={accountType}
        caps={caps}
        walletBalance={walletBalance}
        extraTreeCapacity={extraTreeCapacity}
        unlockedCapsules={unlockedCapsules}
        unlockedAddonSourceIds={unlockedAddonSourceIds}
        userId={userId}
        userEmail={userEmail}
        userPhone={userPhone}
        siteSettings={initialSiteSettings}
        dashboardNotifications={dashboardNotifications}
        onNavigateTab={onNavigateTab}
        onOpenWalletDrawer={onOpenWalletDrawer}
        onOpenNotificationsDrawer={onOpenNotificationsDrawer}
        onUnlockRoot5Usd={onUnlockRoot5Usd}
        onUpgradeAnnualVip={onUpgradeAnnualVip}
        onSignCharterAndEnableTree={onSignCharterAndEnableTree}
        onLogActivity={onLogActivity}
        onAdoptResolvedLineage={onAdoptResolvedLineage}
        onOpenFullResearchTickets={onOpenFullResearchTickets}
        onTicketsStatusChange={onTicketsStatusChange}
      />
    );
  }

  if (activeTab === DashboardTab.MyTree) {
    if (!caps.isVip) {
      return (
        <RoyalPremiumFeatureGate
          feature="my_tree"
          familyName={result.familyName}
          onUpgradePremium={onUpgradeAnnualVip}
          onExploreCommunity={() => onNavigateTab(DashboardTab.MyCommunity)}
        />
      );
    }
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
        extraTreeCapacity={extraTreeCapacity}
        onPurchaseExtraTreeCapacity={onPurchaseExtraTreeCapacity}
        onOpenWalletDrawer={onOpenWalletDrawer}
        userAvatarUrl={userAvatarUrl}
        userId={userId}
        userEmail={userEmail}
        onOpenVaultForPerson={onOpenVaultForPerson}
        onRequestReferenceCorrectionTicket={onRequestReferenceCorrectionTicket}
        initialOpenSettings={openTreeSettingsOnMount}
        onConsumeInitialOpenSettings={() => setOpenTreeSettingsOnMount(false)}
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

  if (activeTab === DashboardTab.MySite) {
    if (!caps.isVip) {
      return (
        <RoyalPremiumFeatureGate
          feature="my_site"
          familyName={result.familyName}
          onUpgradePremium={onUpgradeAnnualVip}
          onExploreCommunity={() => onNavigateTab(DashboardTab.MyCommunity)}
        />
      );
    }
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
        onOpenTreeSettings={() => {
          setOpenTreeSettingsOnMount(true);
          onNavigateTab(DashboardTab.MyTree);
        }}
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
