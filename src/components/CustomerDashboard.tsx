import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  AlertCircle,
  Bell,
  Camera,
  CheckCircle2,
  ChevronDown,
  Crown,
  FileSignature,
  HelpCircle,
  KeyRound,
  Languages,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Phone,
  Scroll,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  User,
  UserRound,
  Users,
  X,
  ArrowRight,
} from 'lucide-react';
import { JUTHORI_SERVICE_ICONS } from '../config/serviceIcons';
import { auth } from '../services/firebase';
import {
  buildVerifiedLineageSnapshot,
  canonicalCustomerEmailUid,
  changeCustomerAccountPassword,
  createCharterRequestInFirebase,
  CustomerCommunityPostData,
  CustomerSiteSettingsData,
  deleteUserAccountFromFirebase,
  executeAtomicWalletOperation,
  fetchCustomerDashboardWorkspace,
  fetchUserLegalAuditTrailFromFirebase,
  fetchUserProfile,
  fetchUserProfileDetailed,
  fetchUserProfileByEmail,
  fetchUserResearchTickets,
  hydrateLineageResultFromSnapshot,
  LegalAuditTrailEntry,
  readCustomerDashboardWorkspaceFromLocal,
  recordLegalAuditTrailInFirebase,
  saveCustomerDashboardWorkspace,
  syncClientLineageTicketToFirebase,
  updateUserProfile,
  uploadUserAvatarToFirebase,
  upsertCustomerOrderInFirebase,
} from '../services/firestoreService';
import {
  RECORD_KEEPER_CONTRACT_METADATA,
  RECORD_KEEPER_CONTRACT_VERSION,
} from '../data/recordKeeperContractData';
import { RecordKeeperContractModal } from './RecordKeeperContractModal';
import { KashafiHubView } from './KashafiHubView';
import { fetchCustomerKashafiItems } from '../services/kashafiService';
import {
  CircleJoinRequestDoc,
  fetchUserReferralDashboard,
  subscribeToOwnerPendingJoinRequests,
} from '../services/priority4Service';
import { SocialJoinRequestsList } from './CircleJoinRequestsPanel';
import {
  AccountLegalType,
  ActivityLogEntry,
  AncestorCapsule,
  CheckoutOrderRequest,
  DashboardStateMode,
  DashboardTab,
  FreeLeadRadarSignal,
  LineageConnectionDecisionStatus,
  LineageSearchResult,
  NotificationItem,
  SilentGeoMetadata,
  VerifiedAddonSourceItem,
} from '../types/juthori';
import { ORIGIN_COUNTRY_OPTIONS } from '../data/arabCountries';
import {
  AL_MUQIT_8_CAPSULES,
  buildResolvedLineageFromDisambiguationOption,
  getDashboardCapabilities,
  searchJuthoriLineage,
} from '../utils/lineageEngine';
import { PendingResearchTicketDraft } from '../utils/handoffStorage';
import { LineageSpineColumn } from './LineageSpineColumn';
import { PremiumTabViews } from './PremiumTabViews';
import { WalletView } from './WalletView';
import { JuthoriLogo } from './JuthoriLogo';
import {
  RoyalRoleFamilyBadge,
  formatRoyalFamilyLabel,
  resolveRoyalRoleLabel,
} from './RoyalRoleFamilyBadge';
import { DashboardHeaderWatermark } from './DashboardHeaderWatermark';
import { CheckoutExecutionResult, CheckoutModal } from './CheckoutModal';
import { SupportAndHelpCenterView } from './SupportAndHelpCenterView';
import { ResearchTicketsView } from './ResearchTicketsView';
import {
  UpgradePromptRequest,
  UpgradeToPremiumModal,
} from './UpgradeToPremiumModal';
import {
  BillingCycle,
  SUBSCRIPTION_PLANS,
  formatPlanPriceUsd,
  getPlanPriceUsd,
  getPlanRank,
  getRequiredPlanForFeature,
} from '../config/subscriptionPlans';

interface CustomerDashboardProps {
  stateMode: DashboardStateMode;
  onChangeStateMode: (nextMode: DashboardStateMode) => void;
  accountType: AccountLegalType;
  onUpgradeAccountToRecordKeeper: () => void;
  onToggleAccountTypeForTest: (type: AccountLegalType) => void;
  result: LineageSearchResult;
  silentGeo: SilentGeoMetadata;
  userEmail: string;
  userId?: string;
  userAvatarUrl?: string;
  userPhone?: string;
  userDefaultCountry?: string;
  userOriginRegion?: string;
  onBackToLanding: () => void;
  onLogout?: () => void;
  onUpdateImmediateParents?: (fatherName: string, grandfatherName: string) => void;
  onUpdateProfileDetails?: (details: {
    firstName: string;
    fatherName: string;
    grandfatherName: string;
    familyName: string;
    phone: string;
    defaultCountry: string;
    originCountry: string;
    originRegion: string;
    tribeName?: string;
    branchName?: string;
    avatarUrl?: string;
  }) => void;
  onUpdateLineageResult?: (nextResult: LineageSearchResult) => void;
  onDeleteAccount?: () => Promise<void>;
  initialTab?: DashboardTab;
  initialTicketDraft?: PendingResearchTicketDraft | null;
  onClearInitialTicketDraft?: () => void;
  initialAutoOpenVipUpgrade?: boolean;
  onClearAutoOpenVipUpgrade?: () => void;
  initialSelectedPlanIntent?: {
    planId: 'basic' | 'premium';
    billingCycle: BillingCycle;
  } | null;
  onClearInitialPlanIntent?: () => void;
  onResyncLineageFromEngine?: () => Promise<void>;
  isResyncingLineage?: boolean;
}

const DASHBOARD_TABS: Array<{
  id: DashboardTab;
  label: string;
  premium: boolean;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}> = [
  { id: DashboardTab.Home, label: 'الرئيسية', premium: false, icon: JUTHORI_SERVICE_ICONS.home },
  {
    id: DashboardTab.Lineage,
    label: 'عمود نسبي',
    premium: false,
    icon: JUTHORI_SERVICE_ICONS.lineage,
  },
  { id: DashboardTab.MyTree, label: 'شجرتي', premium: true, icon: JUTHORI_SERVICE_ICONS.tree },
  { id: DashboardTab.MyVault, label: 'خزانتي', premium: false, icon: JUTHORI_SERVICE_ICONS.vault },
  { id: DashboardTab.MyExplorer, label: 'كشّافي', premium: false, icon: JUTHORI_SERVICE_ICONS.kashafi },
  { id: DashboardTab.MySite, label: 'موقعي', premium: true, icon: JUTHORI_SERVICE_ICONS.site },
  { id: DashboardTab.MyCommunity, label: 'مجتمعي', premium: false, icon: JUTHORI_SERVICE_ICONS.community },
];

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  stateMode,
  onChangeStateMode,
  accountType,
  onUpgradeAccountToRecordKeeper,
  result,
  silentGeo,
  userEmail,
  userId,
  userAvatarUrl: initialAvatarUrl,
  userPhone: initialPhone = '',
  userDefaultCountry: initialDefaultCountry = '',
  userOriginRegion: initialOriginRegion = '',
  onBackToLanding,
  onLogout,
  onUpdateImmediateParents,
  onUpdateProfileDetails,
  onUpdateLineageResult,
  onDeleteAccount,
  initialTab,
  initialTicketDraft = null,
  onClearInitialTicketDraft,
  initialAutoOpenVipUpgrade = false,
  onClearAutoOpenVipUpgrade,
  initialSelectedPlanIntent = null,
  onClearInitialPlanIntent,
  onResyncLineageFromEngine,
  isResyncingLineage = false,
}) => {
  const resolvedCustomerUid =
    userId ||
    auth.currentUser?.uid ||
    canonicalCustomerEmailUid(userEmail) ||
    (userEmail ? `usr_${userEmail.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '');

  const initialWorkspace = readCustomerDashboardWorkspaceFromLocal(
    resolvedCustomerUid,
    userEmail
  );
  const initialWorkspaceMatchesFamily =
    !initialWorkspace?.familyName ||
    !result.familyName ||
    initialWorkspace.familyName.trim() === result.familyName.trim();

  const [activeTab, setActiveTab] = useState<DashboardTab>(() =>
    initialTab ? initialTab : DashboardTab.Home
  );
  const [vaultPersonFilterId, setVaultPersonFilterId] =
    useState<string | null>(null);
  const [hasCustomerResearchTicket, setHasCustomerResearchTicket] =
    useState<boolean>(false);
  const [hasResearcherReplyWaiting, setHasResearcherReplyWaiting] =
    useState<boolean>(false);
  const [kashafiUnreadItemsCount, setKashafiUnreadItemsCount] =
    useState<number>(0);

  useEffect(() => {
    if (initialTicketDraft) {
      onClearInitialTicketDraft?.();
    }
  }, [initialTicketDraft, onClearInitialTicketDraft]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (!resolvedCustomerUid && !userEmail) return;
    let cancelled = false;
    fetchUserResearchTickets(resolvedCustomerUid, userEmail)
      .then((list) => {
        if (cancelled) return;
        const valid = Array.isArray(list) ? list : [];
        setHasCustomerResearchTicket(valid.length > 0);
        const waiting = valid.some((t) => {
          if (t.status === 'NEEDS_INFO' || t.lifecycleStage === 'NEEDS_INFO') {
            return true;
          }
          const msgs = t.messages || [];
          const lastMsg = msgs[msgs.length - 1];
          return Boolean(lastMsg && lastMsg.senderRole === 'researcher');
        });
        setHasResearcherReplyWaiting(waiting);
      })
      .catch(() => {});

    fetchCustomerKashafiItems(resolvedCustomerUid, userEmail)
      .then((items) => {
        if (cancelled) return;
        setKashafiUnreadItemsCount(items.filter((i) => !i.isRead).length);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [resolvedCustomerUid, userEmail, stateMode]);

  const [bridgedAncestors, setBridgedAncestors] = useState<string[]>(() =>
    initialWorkspaceMatchesFamily && Array.isArray(initialWorkspace?.bridgedAncestors)
      ? initialWorkspace!.bridgedAncestors!
      : []
  );
  const [bilingualLabels, setBilingualLabels] = useState(false);
  const [activeUpgradePrompt, setActiveUpgradePrompt] =
    useState<UpgradePromptRequest | null>(null);
  const pendingUpgradePromptRef = useRef<UpgradePromptRequest | null>(null);

  // Wallet Balance & Unlocked Capsules (Stage 4 of Adam Tree)
  const [walletBalance, setWalletBalance] = useState<number>(
    stateMode === DashboardStateMode.AnnualVip ? 25 : 0
  );
  const [extraTreeCapacity, setExtraTreeCapacity] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const saved = window.localStorage.getItem(
        `juthori_extra_tree_capacity_${userEmail || 'guest'}`
      );
      const parsed = Number(saved || 0);
      return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
    } catch {
      return 0;
    }
  });
  const [activeBillingCycle, setActiveBillingCycle] = useState<BillingCycle>(() => {
    if (typeof window === 'undefined') return 'annual';
    try {
      const saved = window.localStorage.getItem(
        `juthori_billing_cycle_${userEmail || 'guest'}`
      );
      return saved === 'monthly' ? 'monthly' : 'annual';
    } catch {
      return 'annual';
    }
  });
  const [ambassadorCapacityBonus, setAmbassadorCapacityBonus] = useState<number>(0);
  const [ambassadorFreeMonths, setAmbassadorFreeMonths] = useState<number>(0);
  const [unlockedCapsules, setUnlockedCapsules] = useState<string[]>(() =>
    initialWorkspaceMatchesFamily && Array.isArray(initialWorkspace?.unlockedCapsules)
      ? initialWorkspace!.unlockedCapsules!
      : []
  );
  const [unlockedAddonSourceIds, setUnlockedAddonSourceIds] = useState<
    string[]
  >(() =>
    initialWorkspaceMatchesFamily &&
    Array.isArray(initialWorkspace?.unlockedAddonSourceIds)
      ? initialWorkspace!.unlockedAddonSourceIds!
      : []
  );
  const [activeCheckoutOrder, setActiveCheckoutOrder] =
    useState<CheckoutOrderRequest | null>(null);

  useEffect(() => {
    if (initialSelectedPlanIntent) {
      const { planId, billingCycle } = initialSelectedPlanIntent;
      const plan = SUBSCRIPTION_PLANS[planId];
      const amountUsd = getPlanPriceUsd(planId, billingCycle);
      const cycleLabel = billingCycle === 'annual' ? 'سنوياً' : 'شهرياً';
      setActiveCheckoutOrder({
        id: `ord-${planId}-${billingCycle}`,
        type: planId === 'premium' ? 'upgrade_premium' : 'upgrade_basic',
        targetPlanId: planId,
        billingCycle,
        title: `الاشتراك في ${plan.nameAr} (${plan.code}) — ${formatPlanPriceUsd(amountUsd)} ${cycleLabel}`,
        subtitle: plan.taglineAr,
        amountUsd,
        allowWalletPayment: true,
        bonusWalletUsd: 0,
      });
      onClearInitialPlanIntent?.();
      return;
    }
    if (!initialAutoOpenVipUpgrade) return;
    const premiumPlan = SUBSCRIPTION_PLANS.premium;
    const amountUsd = getPlanPriceUsd('premium', 'annual');
    setActiveCheckoutOrder({
      id: 'ord-premium-annual',
      type: 'upgrade_premium',
      targetPlanId: 'premium',
      billingCycle: 'annual',
      title: `الاشتراك في ${premiumPlan.nameAr} (${premiumPlan.code}) — ${formatPlanPriceUsd(amountUsd)} سنوياً`,
      subtitle: premiumPlan.taglineAr,
      amountUsd,
      allowWalletPayment: true,
      bonusWalletUsd: 0,
    });
    onClearAutoOpenVipUpgrade?.();
  }, [
    initialAutoOpenVipUpgrade,
    onClearAutoOpenVipUpgrade,
    initialSelectedPlanIntent,
    onClearInitialPlanIntent,
  ]);
  const [verifiedResultOverride, setVerifiedResultOverride] =
    useState<LineageSearchResult | null>(() => {
      if (
        initialWorkspaceMatchesFamily &&
        initialWorkspace?.verifiedResultOverrideJson
      ) {
        try {
          return JSON.parse(
            initialWorkspace.verifiedResultOverrideJson
          ) as LineageSearchResult;
        } catch {
          return null;
        }
      }
      return null;
    });
  const [siteSettings, setSiteSettings] = useState<
    CustomerSiteSettingsData | undefined
  >(() => initialWorkspace?.siteSettings);
  const [communityPosts, setCommunityPosts] = useState<
    CustomerCommunityPostData[] | undefined
  >(() => initialWorkspace?.communityPosts);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>(() =>
    Array.isArray(initialWorkspace?.blockedUserIds)
      ? initialWorkspace!.blockedUserIds!
      : []
  );
  const [blockedUsersMeta, setBlockedUsersMeta] = useState<
    Array<{ userId: string; name: string; blockedAt: string }>
  >(() =>
    Array.isArray(initialWorkspace?.blockedUsersMeta)
      ? initialWorkspace!.blockedUsersMeta!
      : []
  );

  const prevFamilyNameRef = useRef<string>((result.familyName || '').trim());
  const isWorkspaceHydratedRef = useRef<boolean>(false);

  // Only reset family-specific overrides when the user genuinely switches from one non-empty family to another
  useEffect(() => {
    const nextFam = (result.familyName || '').trim();
    const prevFam = prevFamilyNameRef.current;
    if (prevFam && nextFam && prevFam !== nextFam) {
      setVerifiedResultOverride(null);
      setUnlockedCapsules([]);
      setBridgedAncestors([]);
    }
    if (nextFam) {
      prevFamilyNameRef.current = nextFam;
    }
  }, [result.familyName]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [activeTab, stateMode]);

  const activeResult = verifiedResultOverride || result;

  // User Avatar Dropdown & Mobile Active-Tab Rail Refs
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const mobileTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Modals & Exclusive Utility Pages
  const [showCharterModal, setShowCharterModal] = useState(false);
  const [userAuditTrail, setUserAuditTrail] = useState<LegalAuditTrailEntry[]>([]);
  const [charterSignedBanner, setCharterSignedBanner] = useState<{
    certificateCode: string;
    signedAt: string;
  } | null>(null);
  const [lockedTabPromptName, setLockedTabPromptName] = useState<string | null>(null);
  const [activeUtilityDrawer, setActiveUtilityDrawer] = useState<
    'profile' | 'settings' | 'cart' | 'notifications' | 'activity' | 'help' | null
  >(null);

  // Profile & Settings Form State (Connected to Firebase)
  const [avatarUrl, setAvatarUrl] = useState<string>(initialAvatarUrl || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [editFirstName, setEditFirstName] = useState(result.clientName || '');
  const [editFatherName, setEditFatherName] = useState(
    result.fatherName && result.fatherName !== '—' ? result.fatherName : ''
  );
  const [editGrandfatherName, setEditGrandfatherName] = useState(
    result.grandfatherName && result.grandfatherName !== '—'
      ? result.grandfatherName
      : ''
  );
  const [editFamilyName, setEditFamilyName] = useState(result.familyName || '');
  const [editPhone, setEditPhone] = useState(
    initialPhone || initialWorkspace?.phone || ''
  );
  const [editDefaultCountry, setEditDefaultCountry] = useState(
    initialDefaultCountry ||
      initialWorkspace?.defaultCountry ||
      result.originCountry ||
      silentGeo.ip_country ||
      'السعودية'
  );
  const [editOriginCountry, setEditOriginCountry] = useState(
    result.originCountry || 'السعودية'
  );
  const [editOriginRegion, setEditOriginRegion] = useState(
    initialOriginRegion || result.originRegion || ''
  );
  const [profileSaveFeedback, setProfileSaveFeedback] = useState<string | null>(
    null
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Security, Non-Blocking Email Verification & Wallet Shortfall State
  const isGoogleAuthSession = Boolean(
    auth.currentUser?.providerData?.some((p) => p.providerId === 'google.com')
  );
  const hasPasswordAuthProvider = Boolean(
    auth.currentUser?.providerData?.some((p) => p.providerId === 'password')
  );
  const isGoogleOnlyPasswordlessSession =
    isGoogleAuthSession && !hasPasswordAuthProvider;
  const emailVerifiedCacheKey = `juthori_email_verified_v1_${(
    userEmail ||
    resolvedCustomerUid ||
    'guest'
  )
    .trim()
    .toLowerCase()}`;
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(() => {
    if (isGoogleAuthSession || auth.currentUser?.emailVerified === true) {
      return true;
    }
    if (typeof window !== 'undefined') {
      try {
        return window.localStorage.getItem(emailVerifiedCacheKey) === 'true';
      } catch {
        return false;
      }
    }
    return false;
  });
  const [emailVerifiedAt, setEmailVerifiedAt] = useState<string | null>(null);
  const [dismissedEmailBannerInProfile, setDismissedEmailBannerInProfile] =
    useState(false);
  const [dismissedEmailBannerInWallet, setDismissedEmailBannerInWallet] =
    useState(false);
  const [isSendingVerificationOtp, setIsSendingVerificationOtp] =
    useState(false);
  const [verificationOtpSent, setVerificationOtpSent] = useState(false);
  const [verificationOtpInput, setVerificationOtpInput] = useState('');
  const [isVerifyingOtpCode, setIsVerifyingOtpCode] = useState(false);
  const [verificationResendCooldown, setVerificationResendCooldown] =
    useState(0);
  const [verificationFeedback, setVerificationFeedback] = useState<{
    type: 'success' | 'error' | 'diagnostic';
    text: string;
  } | null>(null);
  const [walletShortfallUsd, setWalletShortfallUsd] = useState<number | null>(
    null
  );

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [emailNotificationsTicket, setEmailNotificationsTicket] = useState(true);
  const [emailNotificationsTree, setEmailNotificationsTree] = useState(true);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [freeLeadRadarSignal, setFreeLeadRadarSignal] =
    useState<FreeLeadRadarSignal | null>(null);
  const [lineageResearchStatus, setLineageResearchStatus] =
    useState<LineageConnectionDecisionStatus | undefined>(undefined);
  const [lineageResearchStatusNote, setLineageResearchStatusNote] =
    useState<string>('');

  useEffect(() => {
    if (verificationResendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setVerificationResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [verificationResendCooldown]);

  useEffect(() => {
    if (initialAvatarUrl) {
      setAvatarUrl(initialAvatarUrl);
    }
  }, [initialAvatarUrl]);

  useEffect(() => {
    if (typeof initialPhone === 'string' && initialPhone.trim()) {
      setEditPhone(initialPhone.trim());
    }
  }, [initialPhone]);

  useEffect(() => {
    if (
      typeof initialDefaultCountry === 'string' &&
      initialDefaultCountry.trim()
    ) {
      setEditDefaultCountry(initialDefaultCountry.trim());
    }
  }, [initialDefaultCountry]);

  // Restore persisted walletBalance, unlockedCapsules, bridgedAncestors, addon sources, subscription state, and workspace from Firestore on mount
  useEffect(() => {
    let cancelled = false;
    const activeUid = resolvedCustomerUid;

    let retryTimer: number | null = null;

    async function hydrateFromFirestore(isRetry = false) {
      try {
        const [profileDetailed, workspace] = await Promise.all([
          activeUid
            ? fetchUserProfileDetailed(activeUid)
            : Promise.resolve({ status: 'not_found' as const, profile: null }),
          fetchCustomerDashboardWorkspace(activeUid, userEmail),
        ]);
        if (cancelled) return;

        if (profileDetailed.status === 'transient_error' && !isRetry) {
          retryTimer = window.setTimeout(() => {
            if (!cancelled) {
              hydrateFromFirestore(true);
            }
          }, 4000);
        }

        const profile =
          profileDetailed.profile ||
          (userEmail ? await fetchUserProfileByEmail(userEmail) : null);
        if (cancelled) return;

        if (profile) {
          const googleVerified = Boolean(
            auth.currentUser?.providerData?.some(
              (p) => p.providerId === 'google.com'
            )
          );
          const firebaseVerified = auth.currentUser?.emailVerified === true;
          if (
            googleVerified ||
            firebaseVerified ||
            profile.emailVerified === true
          ) {
            setIsEmailVerified(true);
            try {
              window.localStorage.setItem(emailVerifiedCacheKey, 'true');
            } catch {
              // ignore storage errors
            }
            if (profile.emailVerifiedAt) {
              setEmailVerifiedAt(profile.emailVerifiedAt);
            }
          } else {
            setIsEmailVerified(false);
            try {
              window.localStorage.removeItem(emailVerifiedCacheKey);
            } catch {
              // ignore storage errors
            }
          }

          if (typeof profile.walletBalance === 'number') {
            setWalletBalance(profile.walletBalance);
          }
          if (
            typeof profile.extraTreeCapacity === 'number' &&
            profile.extraTreeCapacity >= 0
          ) {
            setExtraTreeCapacity(Math.floor(profile.extraTreeCapacity));
          }
          if (
            Array.isArray(profile.unlockedCapsules) &&
            profile.unlockedCapsules.length > 0
          ) {
            setUnlockedCapsules(profile.unlockedCapsules);
          }
          if (
            Array.isArray(profile.bridgedAncestors) &&
            profile.bridgedAncestors.length > 0
          ) {
            setBridgedAncestors(profile.bridgedAncestors);
          }
          if (
            Array.isArray(profile.unlockedAddonSourceIds) &&
            profile.unlockedAddonSourceIds.length > 0
          ) {
            setUnlockedAddonSourceIds(profile.unlockedAddonSourceIds);
          }
          if (typeof profile.emailNotificationsTicket === 'boolean') {
            setEmailNotificationsTicket(profile.emailNotificationsTicket);
          }
          if (typeof profile.emailNotificationsTree === 'boolean') {
            setEmailNotificationsTree(profile.emailNotificationsTree);
          }
          const restoredPhone =
            (typeof profile.phone === 'string' && profile.phone.trim()) ||
            (typeof workspace?.phone === 'string' && workspace.phone.trim()) ||
            '';
          if (restoredPhone) {
            setEditPhone(restoredPhone);
          }
          const restoredDefaultCountry =
            (typeof profile.defaultCountry === 'string' &&
              profile.defaultCountry.trim()) ||
            (typeof workspace?.defaultCountry === 'string' &&
              workspace.defaultCountry.trim()) ||
            '';
          if (restoredDefaultCountry) {
            setEditDefaultCountry(restoredDefaultCountry);
          }
          if (typeof profile.avatarUrl === 'string' && profile.avatarUrl.trim()) {
            setAvatarUrl(profile.avatarUrl);
          }
          if (typeof profile.firstName === 'string' && profile.firstName.trim()) {
            setEditFirstName(profile.firstName.trim());
          }
          if (typeof profile.fatherName === 'string') {
            setEditFatherName(
              profile.fatherName === '—' ? '' : profile.fatherName.trim()
            );
          }
          if (typeof profile.grandfatherName === 'string') {
            setEditGrandfatherName(
              profile.grandfatherName === '—'
                ? ''
                : profile.grandfatherName.trim()
            );
          }
          if (
            onUpdateProfileDetails &&
            (restoredPhone || restoredDefaultCountry || profile.avatarUrl)
          ) {
            onUpdateProfileDetails({
              firstName: profile.firstName || result.clientName || '',
              fatherName:
                profile.fatherName && profile.fatherName !== '—'
                  ? profile.fatherName
                  : result.fatherName && result.fatherName !== '—'
                  ? result.fatherName
                  : '',
              grandfatherName:
                profile.grandfatherName && profile.grandfatherName !== '—'
                  ? profile.grandfatherName
                  : result.grandfatherName && result.grandfatherName !== '—'
                  ? result.grandfatherName
                  : '',
              familyName: result.familyName || profile.familyName || '',
              phone: restoredPhone || initialPhone || '',
              defaultCountry:
                restoredDefaultCountry ||
                initialDefaultCountry ||
                result.originCountry ||
                'السعودية',
              originCountry:
                result.originCountry || profile.originCountry || 'السعودية',
              originRegion:
                initialOriginRegion ||
                result.originRegion ||
                profile.originRegion ||
                '',
              avatarUrl: profile.avatarUrl || undefined,
            });
          }
          if (Array.isArray(profile.blockedUserIds)) {
            setBlockedUserIds(profile.blockedUserIds);
          }
          if (Array.isArray(profile.blockedUsersMeta)) {
            setBlockedUsersMeta(profile.blockedUsersMeta);
          }
          const normalizedTier = String(
            profile.subscriptionTier || 'free'
          ).toLowerCase();
          const isPaidAnnual =
            normalizedTier === 'premium_annual' ||
            normalizedTier === 'annual_vip' ||
            normalizedTier === 'premium_monthly' ||
            normalizedTier === 'lifetime_patron' ||
            (typeof profile.paidRevenueUsd === 'number' &&
              profile.paidRevenueUsd >= 55);
          const isPaidBasicRoot =
            normalizedTier === 'basic_verified' ||
            normalizedTier === 'basic_5' ||
            normalizedTier === 'basic_root' ||
            profile.isRootUnlocked === true ||
            (typeof profile.paidRevenueUsd === 'number' &&
              profile.paidRevenueUsd >= 5);

          if (isPaidAnnual && stateMode !== DashboardStateMode.AnnualVip) {
            onChangeStateMode(DashboardStateMode.AnnualVip);
          } else if (
            !isPaidAnnual &&
            isPaidBasicRoot &&
            stateMode !== DashboardStateMode.State1Paid5Basic
          ) {
            onChangeStateMode(DashboardStateMode.State1Paid5Basic);
          } else if (
            !isPaidAnnual &&
            !isPaidBasicRoot &&
            (stateMode === DashboardStateMode.AnnualVip ||
              stateMode === DashboardStateMode.State1Paid5Basic)
          ) {
            // Strict tier isolation: never retain stale AnnualVip/BasicRoot state on a free account
            onChangeStateMode(
              result.matched
                ? DashboardStateMode.State2MatchedUnpaid
                : DashboardStateMode.State3Unmatched
            );
          }
          if (
            (profile.accountType === 'record_keeper' ||
              profile.recordKeeperCharterSigned) &&
            accountType !== AccountLegalType.RecordKeeper
          ) {
            onUpgradeAccountToRecordKeeper();
          }

          if (profile.freeLeadRadarSignal) {
            setFreeLeadRadarSignal(profile.freeLeadRadarSignal);
          }
          if (profile.lineageResearchStatus) {
            setLineageResearchStatus(profile.lineageResearchStatus);
          }
          if (typeof profile.lineageResearchStatusNote === 'string') {
            setLineageResearchStatusNote(profile.lineageResearchStatusNote);
          }

          const savedSnap =
            profile.verifiedLineageSnapshot || profile.lineageSnapshot;
          if (
            savedSnap &&
            (!result.familyName ||
              !savedSnap.familyName ||
              savedSnap.familyName.trim() === result.familyName.trim())
          ) {
            const hydratedFromProfile = hydrateLineageResultFromSnapshot(
              savedSnap,
              profile
            );
            if (hydratedFromProfile) {
              const isManagerApproved =
                Boolean(
                  savedSnap.confidenceLabel?.includes('معتمد من مدير البحوث')
                ) || profile.lineageResearchStatus === 'verified_connected';
              setVerifiedResultOverride((curr) =>
                isManagerApproved ? hydratedFromProfile : curr || hydratedFromProfile
              );
            }
          }
        }

        if (workspace) {
          if (
            !profile?.phone &&
            typeof workspace.phone === 'string' &&
            workspace.phone.trim()
          ) {
            setEditPhone(workspace.phone.trim());
          }
          if (
            !profile?.defaultCountry &&
            typeof workspace.defaultCountry === 'string' &&
            workspace.defaultCountry.trim()
          ) {
            setEditDefaultCountry(workspace.defaultCountry.trim());
          }
          const sameFamily =
            !workspace.familyName ||
            !result.familyName ||
            workspace.familyName.trim() === result.familyName.trim();
          if (
            sameFamily &&
            Array.isArray(workspace.bridgedAncestors) &&
            workspace.bridgedAncestors.length > 0
          ) {
            setBridgedAncestors(workspace.bridgedAncestors);
          }
          if (
            sameFamily &&
            Array.isArray(workspace.unlockedCapsules) &&
            workspace.unlockedCapsules.length > 0
          ) {
            setUnlockedCapsules(workspace.unlockedCapsules);
          }
          if (
            sameFamily &&
            Array.isArray(workspace.unlockedAddonSourceIds) &&
            workspace.unlockedAddonSourceIds.length > 0
          ) {
            setUnlockedAddonSourceIds(workspace.unlockedAddonSourceIds);
          }
          if (sameFamily && workspace.verifiedResultOverrideJson) {
            try {
              const parsedOverride = JSON.parse(
                workspace.verifiedResultOverrideJson
              ) as LineageSearchResult;
              if (parsedOverride && parsedOverride.familyName) {
                setVerifiedResultOverride(parsedOverride);
              }
            } catch {
              // Ignore invalid JSON
            }
          }
          if (workspace.siteSettings) {
            setSiteSettings(workspace.siteSettings);
          }
          if (Array.isArray(workspace.blockedUserIds)) {
            setBlockedUserIds((prev) =>
              Array.from(new Set([...prev, ...(workspace.blockedUserIds || [])]))
            );
          }
          if (
            Array.isArray(workspace.blockedUsersMeta) &&
            workspace.blockedUsersMeta.length > 0
          ) {
            setBlockedUsersMeta((prev) => {
              const map = new Map<
                string,
                { userId: string; name: string; blockedAt: string }
              >();
              prev.forEach((m) => map.set(m.userId, m));
              workspace.blockedUsersMeta!.forEach((m) => map.set(m.userId, m));
              return Array.from(map.values());
            });
          }
          if (
            Array.isArray(workspace.communityPosts) &&
            workspace.communityPosts.length > 0
          ) {
            setCommunityPosts(workspace.communityPosts);
          }
          if (
            Array.isArray(workspace.activityLog) &&
            workspace.activityLog.length > 0
          ) {
            setActivityLog(
              workspace.activityLog.map((entry) => ({
                id: entry.id,
                action: entry.badge || 'نشاط الحساب',
                detail: entry.title,
                timestamp: entry.timestamp,
              }))
            );
          }
        }
        isWorkspaceHydratedRef.current = true;
      } catch {
        isWorkspaceHydratedRef.current = true;
      }

      try {
        const auditLogs = await fetchUserLegalAuditTrailFromFirebase(
          activeUid,
          userEmail
        );
        if (!cancelled && auditLogs.length > 0) {
          setUserAuditTrail(auditLogs);
        }
      } catch {
        // Non-blocking
      }
    }

    hydrateFromFirestore();
    return () => {
      cancelled = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [resolvedCustomerUid, userEmail]);

  useEffect(() => {
    setEditFirstName(result.clientName || '');
    setEditFatherName(
      result.fatherName && result.fatherName !== '—' ? result.fatherName : ''
    );
    setEditGrandfatherName(
      result.grandfatherName && result.grandfatherName !== '—'
        ? result.grandfatherName
        : ''
    );
    setEditFamilyName(result.familyName || '');
    setEditOriginCountry(result.originCountry || 'السعودية');
    setEditOriginRegion(initialOriginRegion || result.originRegion || '');
  }, [
    result.clientName,
    result.fatherName,
    result.grandfatherName,
    result.familyName,
    result.originCountry,
    result.originRegion,
    initialOriginRegion,
  ]);

  // Close User Avatar Dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setUserDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Keep active tab centered smoothly on mobile horizontal navigation rail
  useEffect(() => {
    const el = mobileTabRefs.current[activeTab];
    if (el && typeof window !== 'undefined' && window.innerWidth < 768) {
      el.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [activeTab]);

  // Mandatory Global Scroll-to-Top on any tab or utility page change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeTab, activeUtilityDrawer]);

  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([
    {
      id: 'act-init-1',
      action: 'فحص أولي في محرك الأنساب',
      detail: `البحث عن عمود نسب ${result.clientName} (${result.familyName}) — ${result.originCountry}`,
      timestamp: 'اليوم · قبل دقيقة',
    },
  ]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif-1',
      title: 'تم رصد عقدة مطابقة لعائلتك',
      body: `وجدنا ارتباطاً موثقاً لـ ${result.familyName}. افتح الجذر بـ $5 أو رقِّ لبريميوم لفتح العمود الكامل.`,
      timestamp: 'الآن',
      unread: true,
      actionType: 'unlock_5',
    },
    {
      id: 'notif-2',
      title: 'مزايا الاشتراك السنوي (بريميوم)',
      body: 'ارفع الأقفال الحمراء عن المحطات المرمّزة في شجرة آدم وفعّل شجرتي وخزانتي وموقعي ومجتمعي.',
      timestamp: 'منذ دقيقتين',
      unread: true,
      actionType: 'upgrade_vip',
    },
  ]);

  const caps = getDashboardCapabilities(stateMode, accountType);

  const appendActivity = (action: string, detail: string) => {
    const stamp = new Date().toLocaleString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    });
    setActivityLog((prev) => {
      const next = [
        {
          id: `act-${Date.now()}`,
          action,
          detail,
          timestamp: stamp,
        },
        ...prev,
      ].slice(0, 40);
      saveCustomerDashboardWorkspace(resolvedCustomerUid, userEmail, {
        familyName: result.familyName,
        activityLog: next.map((item) => ({
          id: item.id,
          badge: item.action,
          title: item.detail,
          timestamp: item.timestamp,
        })),
      }).catch(() => {});
      return next;
    });
  };

  // Persist CustomerDashboard workspace state (عمود نسبي + موقعي + مجتمعي) to Firestore automatically
  useEffect(() => {
    if (!isWorkspaceHydratedRef.current) return;
    saveCustomerDashboardWorkspace(resolvedCustomerUid, userEmail, {
      familyName: activeResult.familyName || result.familyName,
      bridgedAncestors,
      unlockedCapsules,
      unlockedAddonSourceIds,
      verifiedResultOverrideJson: verifiedResultOverride
        ? JSON.stringify(verifiedResultOverride)
        : null,
      phone: editPhone.trim(),
      defaultCountry: editDefaultCountry,
      siteSettings,
      communityPosts,
      blockedUserIds,
      blockedUsersMeta,
    }).catch(() => {});

    if (resolvedCustomerUid) {
      updateUserProfile(resolvedCustomerUid, {
        bridgedAncestors: bridgedAncestors.slice(0, 100),
        unlockedCapsules: unlockedCapsules.slice(0, 100),
        unlockedAddonSourceIds: unlockedAddonSourceIds.slice(0, 200),
        blockedUserIds: blockedUserIds.slice(0, 200),
        blockedUsersMeta: blockedUsersMeta.slice(0, 200),
      }).catch(() => {});
    }
  }, [
    bridgedAncestors,
    unlockedCapsules,
    unlockedAddonSourceIds,
    verifiedResultOverride,
    siteSettings,
    communityPosts,
    blockedUserIds,
    blockedUsersMeta,
    resolvedCustomerUid,
    userEmail,
    activeResult.familyName,
    result.familyName,
  ]);

  const handleBlockCommunityUser = (targetUid: string, targetName: string) => {
    const cleanUid = (targetUid || '').trim();
    if (!cleanUid || cleanUid === resolvedCustomerUid) return;
    const nowIso = new Date().toISOString();
    const nextIds = Array.from(new Set([...blockedUserIds, cleanUid])).slice(0, 200);
    const nextMeta = [
      {
        userId: cleanUid,
        name: (targetName || 'عضو المجتمع').trim().slice(0, 120),
        blockedAt: nowIso,
      },
      ...blockedUsersMeta.filter((m) => m.userId !== cleanUid),
    ].slice(0, 200);

    setBlockedUserIds(nextIds);
    setBlockedUsersMeta(nextMeta);
    if (resolvedCustomerUid) {
      updateUserProfile(resolvedCustomerUid, {
        blockedUserIds: nextIds,
        blockedUsersMeta: nextMeta,
      }).catch(() => {});
      saveCustomerDashboardWorkspace(resolvedCustomerUid, userEmail, {
        familyName: activeResult.familyName || result.familyName,
        blockedUserIds: nextIds,
        blockedUsersMeta: nextMeta,
      }).catch(() => {});
    }
    appendActivity(
      'حظر مستخدم في مجتمعي',
      `تم إخفاء منشورات وتعليقات «${targetName || cleanUid}» فوراً من واجهتك`
    );
  };

  const handleUnblockCommunityUser = (targetUid: string) => {
    const cleanUid = (targetUid || '').trim();
    const removedMeta = blockedUsersMeta.find((m) => m.userId === cleanUid);
    const nextIds = blockedUserIds.filter((id) => id !== cleanUid);
    const nextMeta = blockedUsersMeta.filter((m) => m.userId !== cleanUid);

    setBlockedUserIds(nextIds);
    setBlockedUsersMeta(nextMeta);
    if (resolvedCustomerUid) {
      updateUserProfile(resolvedCustomerUid, {
        blockedUserIds: nextIds,
        blockedUsersMeta: nextMeta,
      }).catch(() => {});
      saveCustomerDashboardWorkspace(resolvedCustomerUid, userEmail, {
        familyName: activeResult.familyName || result.familyName,
        blockedUserIds: nextIds,
        blockedUsersMeta: nextMeta,
      }).catch(() => {});
    }
    appendActivity(
      'فك حظر مستخدم في مجتمعي',
      `إعادة إظهار مشاركات «${removedMeta?.name || cleanUid}» في مجتمعي`
    );
  };

  // Avatar File Upload Handler -> Firebase Storage / Firestore
  const handleAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const targetUid = userId || auth.currentUser?.uid || 'guest_user';
      const uploadedUrl = await uploadUserAvatarToFirebase(targetUid, file);
      setAvatarUrl(uploadedUrl);
      if (onUpdateProfileDetails) {
        onUpdateProfileDetails({
          firstName: editFirstName,
          fatherName: editFatherName,
          grandfatherName: editGrandfatherName,
          familyName: editFamilyName,
          phone: editPhone,
          defaultCountry: editDefaultCountry,
          originCountry: editOriginCountry,
          originRegion: editOriginRegion,
          avatarUrl: uploadedUrl,
        });
      }
      appendActivity(
        'تحديث الصورة الشخصية للحساب',
        'تم رفع الصورة الشخصية ومزامنتها في الهيدر وعمود النسب وشجرتي'
      );
      setProfileSaveFeedback('تم تحديث وحفظ صورة الحساب الشخصية بنجاح ✓');
      setTimeout(() => setProfileSaveFeedback(null), 4000);
    } catch {
      setProfileSaveFeedback('تعذر رفع الصورة، يرجى المحاولة بصورة أصغر حجماً.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Save Personal & Residence Country Profile Data to Firebase (Family Name & Origin Country/Region are locked to root linkage)
  const handleSaveProfileData = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSaveFeedback(null);

    const cleanFirst = editFirstName.trim();
    const cleanFather = editFatherName.trim();
    const cleanGrand = editGrandfatherName.trim();
    const cleanPhone = editPhone.trim().slice(0, 30);
    const cleanResidenceCountry = (editDefaultCountry || 'السعودية')
      .trim()
      .slice(0, 60);

    // Strictly preserve locked family name and origin homeland tied to root matching
    const lockedFamily = (
      activeResult.familyName ||
      result.familyName ||
      editFamilyName
    ).trim();
    const lockedOriginCountry = (
      activeResult.originCountry ||
      result.originCountry ||
      editOriginCountry ||
      'السعودية'
    ).trim();
    const lockedOriginRegion = (
      initialOriginRegion ||
      activeResult.originRegion ||
      result.originRegion ||
      editOriginRegion
    ).trim();

    setEditFamilyName(lockedFamily);
    setEditOriginCountry(lockedOriginCountry);
    setEditOriginRegion(lockedOriginRegion);
    setEditPhone(cleanPhone);
    setEditDefaultCountry(cleanResidenceCountry);

    const fullName = [cleanFirst, cleanFather, cleanGrand, lockedFamily]
      .filter(Boolean)
      .join(' ');

    const updatedSnapshotResult: LineageSearchResult = {
      ...activeResult,
      clientName: cleanFirst || activeResult.clientName,
      fatherName: cleanFather || activeResult.fatherName,
      grandfatherName: cleanGrand || activeResult.grandfatherName,
      familyName: lockedFamily || activeResult.familyName,
      originCountry: lockedOriginCountry || activeResult.originCountry,
      originRegion: lockedOriginRegion,
    };

    setVerifiedResultOverride(updatedSnapshotResult);
    if (onUpdateLineageResult) {
      onUpdateLineageResult(updatedSnapshotResult);
    }

    const nextSnapshot = buildVerifiedLineageSnapshot(updatedSnapshotResult);
    const targetUid = auth.currentUser?.uid || userId || resolvedCustomerUid;

    let cloudSaved = false;
    if (targetUid) {
      cloudSaved = await updateUserProfile(targetUid, {
        email: userEmail,
        fullName,
        firstName: cleanFirst,
        fatherName: cleanFather,
        grandfatherName: cleanGrand,
        familyName: lockedFamily,
        phone: cleanPhone,
        defaultCountry: cleanResidenceCountry,
        originCountry: lockedOriginCountry,
        originRegion: lockedOriginRegion,
        avatarUrl: avatarUrl || undefined,
        emailNotificationsEnabled:
          emailNotificationsTicket || emailNotificationsTree,
        verifiedLineageSnapshot: nextSnapshot,
        lineageSnapshot: nextSnapshot,
      });

      await saveCustomerDashboardWorkspace(targetUid, userEmail, {
        familyName: lockedFamily,
        phone: cleanPhone,
        defaultCountry: cleanResidenceCountry,
      }).catch(() => {});
    }

    if (onUpdateImmediateParents) {
      onUpdateImmediateParents(cleanFather, cleanGrand);
    }

    if (onUpdateProfileDetails) {
      onUpdateProfileDetails({
        firstName: cleanFirst,
        fatherName: cleanFather,
        grandfatherName: cleanGrand,
        familyName: lockedFamily,
        phone: cleanPhone,
        defaultCountry: cleanResidenceCountry,
        originCountry: lockedOriginCountry,
        originRegion: lockedOriginRegion,
        avatarUrl: avatarUrl || undefined,
      });
    }

    setIsSavingProfile(false);
    if (!cloudSaved && !auth.currentUser) {
      setProfileSaveFeedback(
        'تعذر تأكيد المزامنة السحابية لانتهاء جلسة المصادقة. يرجى تسجيل الدخول مجدداً لحفظ التعديلات في قاعدة البيانات.'
      );
      return;
    }

    appendActivity(
      'تحديث الملف الشخصي',
      `تم تحديث البيانات الشخصية ورقم الجوال ودولة الإقامة (${fullName})`
    );
    setProfileSaveFeedback(
      'تم حفظ البيانات الشخصية ورقم الجوال ودولة الإقامة في حسابك بنجاح ✓'
    );
    setTimeout(() => setProfileSaveFeedback(null), 4500);
  };

  // Change Password Handler (Real Firebase Authentication Reauthentication + Update)
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (!isGoogleOnlyPasswordlessSession && !currentPassword) {
      setPasswordFeedback({
        type: 'error',
        text: 'يرجى إدخال كلمة المرور الحالية للتحقق من هويتك أولاً.',
      });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordFeedback({
        type: 'error',
        text: 'يجب أن تتكون كلمة المرور الجديدة من 6 خانات على الأقل.',
      });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordFeedback({
        type: 'error',
        text: 'كلمتا المرور الجديدتان غير متطابقتين.',
      });
      return;
    }
    if (!isGoogleOnlyPasswordlessSession && currentPassword === newPassword) {
      setPasswordFeedback({
        type: 'error',
        text: 'كلمة المرور الجديدة مطابقة لكلمة المرور الحالية.',
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await changeCustomerAccountPassword({
        email: userEmail,
        currentPassword,
        newPassword,
      });
      if (!res.ok) {
        setPasswordFeedback({
          type: 'error',
          text:
            res.error ||
            'تعذر تحديث كلمة المرور في قاعدة البيانات. يرجى المحاولة مرة أخرى.',
        });
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      appendActivity(
        'تحديث الأمان',
        'تم تحديث كلمة مرور الحساب في Firebase Authentication بنجاح'
      );
      setPasswordFeedback({
        type: 'success',
        text: 'تم تحديث كلمة المرور فعلياً في قاعدة البيانات ويمكنك استخدامها الآن لتسجيل الدخول ✓',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Delete Account Permanently Handler (Danger Zone)
  const handleConfirmDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const targetUid = userId || auth.currentUser?.uid;
      if (targetUid) {
        await deleteUserAccountFromFirebase(targetUid);
      }
      if (onDeleteAccount) {
        await onDeleteAccount();
      } else if (onLogout) {
        onLogout();
      }
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteAccountConfirm(false);
    }
  };

  // Non-blocking Server-Side Email Verification via Resend (`/api/email/send-verification` & `/api/email/verify-code`)
  const handleSendEmailVerificationCode = async () => {
    if (isSendingVerificationOtp || verificationResendCooldown > 0) return;
    setIsSendingVerificationOtp(true);
    setVerificationFeedback(null);
    try {
      const response = await fetch('/api/email/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          clientName: editFirstName || result.clientName || 'عميل جذوري',
          familyName: editFamilyName || result.familyName || '',
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 429) {
        const waitSec =
          typeof data.cooldownSeconds === 'number'
            ? data.cooldownSeconds
            : typeof data.retryAfterSeconds === 'number'
            ? data.retryAfterSeconds
            : 60;
        setVerificationResendCooldown(waitSec);
        setVerificationFeedback({
          type: 'error',
          text:
            data.diagnosticAr ||
            data.error ||
            `يرجى الانتظار ${waitSec} ثانية قبل طلب إرسال رمز توثيق جديد.`,
        });
        return;
      }

      if (data.sent) {
        setVerificationOtpSent(true);
        setVerificationResendCooldown(
          typeof data.cooldownSeconds === 'number' ? data.cooldownSeconds : 60
        );
        setVerificationFeedback({
          type: 'success',
          text:
            data.message ||
            `تم إرسال رمز التوثيق المكون من 6 أرقام من «منصة جذوري» (info@Juthori.com) إلى (${userEmail}) بنجاح — الرمز صالح لمدة 15 دقيقة.`,
        });
      } else {
        setVerificationFeedback({
          type: 'diagnostic',
          text:
            data.diagnosticAr ||
            data.error ||
            'تعذر إرسال رسالة التوثيق عبر (info@Juthori.com). يرجى التحقق من ربط مفتاح الخدمة بالنطاق الموثق (Juthori.com).',
        });
      }
    } catch {
      setVerificationFeedback({
        type: 'error',
        text: 'تعذر الاتصال بخادم البريد حالياً. يرجى المحاولة مرة أخرى بعد قليل.',
      });
    } finally {
      setIsSendingVerificationOtp(false);
    }
  };

  const handleVerifyEmailOtpCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = verificationOtpInput.trim();
    if (!cleanCode || cleanCode.length < 6 || isVerifyingOtpCode) {
      setVerificationFeedback({
        type: 'error',
        text: 'يرجى إدخال رمز التوثيق المكون من 6 أرقام كاملاً.',
      });
      return;
    }

    setIsVerifyingOtpCode(true);
    setVerificationFeedback(null);
    try {
      const response = await fetch('/api/email/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          code: cleanCode,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !(data.valid || data.verified)) {
        setVerificationFeedback({
          type: 'error',
          text:
            data.message ||
            data.error ||
            'رمز التوثيق غير صحيح أو منتهي الصلاحية. يرجى التأكد والمحاولة مجدداً.',
        });
        return;
      }

      const verifiedIso = data.verifiedAt || new Date().toISOString();
      setIsEmailVerified(true);
      try {
        window.localStorage.setItem(emailVerifiedCacheKey, 'true');
      } catch {
        // ignore storage errors
      }
      setEmailVerifiedAt(verifiedIso);
      setVerificationOtpSent(false);
      setVerificationOtpInput('');
      setVerificationFeedback({
        type: 'success',
        text: 'تم توثيق بريدك الإلكتروني رسمياً وحفظ حالة التوثيق في قاعدة بيانات الحساب ✓',
      });

      const targetUid = userId || auth.currentUser?.uid || resolvedCustomerUid;
      if (targetUid) {
        await updateUserProfile(targetUid, {
          emailVerified: true,
          emailVerifiedAt: verifiedIso,
        }).catch(() => {});
      }

      appendActivity(
        'توثيق البريد الإلكتروني رسمياً',
        `تم تأكيد ملكية البريد (${userEmail}) عبر رمز التوثيق المرسل من الخادم`
      );
    } catch {
      setVerificationFeedback({
        type: 'error',
        text: 'حدث خطأ أثناء التحقق من الرمز. يرجى المحاولة مرة أخرى.',
      });
    } finally {
      setIsVerifyingOtpCode(false);
    }
  };

  // Opens 3-Step Realistic Checkout Modal for $5 Root Unlock (No pre-$5 spoilers!)
  const handleUnlockRoot5Usd = () => {
    setActiveCheckoutOrder({
      id: 'ord-root-5',
      type: 'unlock_root_5',
      title: 'فتح نقطة الربط (الجذر) — الباقة الأساسية',
      subtitle:
        'يكشف عقدتي الجذر الموثق (الفرع الجامع والقبيلة الأم) لعائلتك في السجل التاريخي + رفع سعة شجرتي إلى 50 فرداً وخزانتي إلى 20 وثيقة',
      amountUsd: 5,
      allowWalletPayment: true,
    });
  };

  // Opens 3-Step Checkout Modal for Basic or Premium (Monthly / Annual) using centralized subscriptionPlans.ts
  const handleUpgradeToPlan = (
    planId: 'basic' | 'premium',
    billingCycle: BillingCycle = 'annual'
  ) => {
    setLockedTabPromptName(null);
    setActiveBillingCycle(billingCycle);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          `juthori_billing_cycle_${userEmail || 'guest'}`,
          billingCycle
        );
      } catch {
        // ignore storage errors
      }
    }
    const plan = SUBSCRIPTION_PLANS[planId];
    const amountUsd = getPlanPriceUsd(planId, billingCycle);
    const cycleLabel = billingCycle === 'annual' ? 'سنوياً' : 'شهرياً';
    setActiveCheckoutOrder({
      id: `ord-${planId}-${billingCycle}`,
      type: planId === 'premium' ? 'upgrade_premium' : 'upgrade_basic',
      targetPlanId: planId,
      billingCycle,
      title: `الاشتراك في ${plan.nameAr} (${plan.code}) — ${formatPlanPriceUsd(amountUsd)} ${cycleLabel}`,
      subtitle: plan.taglineAr,
      amountUsd,
      allowWalletPayment: false,
      bonusWalletUsd: 0,
    });
  };

  // Backward-compatible wrapper opening Premium annual checkout
  const handleUpgradeAnnualVip = () => {
    handleUpgradeToPlan('premium', 'annual');
  };

  // Opens 3-Step Realistic Checkout Modal for a Single Intermediate Ancestor Ring ($2 - $4)
  const handleRequestUnlockCapsule = (capsule: AncestorCapsule) => {
    setActiveCheckoutOrder({
      id: `ord-${capsule.id}`,
      type: 'unlock_capsule',
      capsuleId: capsule.id,
      title: `فتح ${capsule.title} (${capsule.ancestors.length} أجداد وسيطين)`,
      subtitle: `${capsule.betweenLabel} — تفكيك الوصلات وتحويلها إلى «بن (سليل مباشر)»`,
      amountUsd: capsule.priceUsd,
      allowWalletPayment: true,
    });
  };

  // Opens 3-Step Realistic Checkout Modal for All Intermediate Rings Bundle ($12)
  const handleRequestUnlockAllCapsulesBundle = () => {
    setActiveCheckoutOrder({
      id: 'ord-all-capsules-12',
      type: 'unlock_all_capsules_12',
      title: 'باقة فتح جميع حلقات الأجداد الوسيطين دفعة واحدة',
      subtitle: `فتح كامل سلسلة الأجداد الفرعيين لعائلة ${result.familyName} حتى آدم عليه السلام بسلسلة نسب متصلة بالكامل`,
      amountUsd: 12,
      allowWalletPayment: true,
    });
  };

  // Unlocks a Verified Addon Source (`VERIFIED_ADDON_SOURCE`) atomically via `runTransaction`
  const handleUnlockVerifiedAddonSource = async (
    addon: VerifiedAddonSourceItem
  ): Promise<boolean> => {
    const priceUsd =
      typeof addon.addon_unlock_price_usd === 'number' &&
      addon.addon_unlock_price_usd > 0
        ? addon.addon_unlock_price_usd
        : 2;
    const addonKey = `${addon.attached_to_node}::${addon.source_id}::${addon.volume}::${addon.page}`;
    if (
      unlockedAddonSourceIds.includes(addonKey) ||
      unlockedAddonSourceIds.includes(addon.source_id)
    ) {
      return true;
    }

    const activeUid =
      userId ||
      auth.currentUser?.uid ||
      resolvedCustomerUid ||
      `usr_${userEmail.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    const res = await executeAtomicWalletOperation({
      userId: activeUid,
      userEmail,
      operationType: 'UNLOCK_CAPSULE',
      amountUsd: priceUsd,
      paymentMethod: 'wallet',
      descriptionAr: `فتح مرجع تاريخي إضافي موثق [${addon.source_id}]: ${addon.canonical_title} (ج${addon.volume} ص${addon.page})`,
      targetAddonSourceId: addonKey,
    });

    if (res.status === 'INSUFFICIENT_FUNDS') {
      const shortfall = Number(
        (res.shortfallUsd ?? Math.max(0, priceUsd - res.balanceBefore)).toFixed(2)
      );
      setWalletBalance(res.balanceBefore);
      setWalletShortfallUsd(shortfall);
      setActiveUtilityDrawer('cart');
      return false;
    }

    const nextAddons = Array.from(
      new Set([...unlockedAddonSourceIds, addonKey, addon.source_id])
    );
    setWalletBalance(res.balanceAfter);
    setUnlockedAddonSourceIds(nextAddons);
    setWalletShortfallUsd(null);

    if (res.status === 'COMPLETED') {
      appendActivity(
        `فتح مرجع تاريخي إضافي (${res.transactionId || 'TXN'}) — $${priceUsd}`,
        `تم كشف بيانات المرجع [${addon.source_id}] «${addon.canonical_title}» (ج${addon.volume} ص${addon.page})`
      );
    }
    return true;
  };

  // Atomic Firestore `runTransaction` executor passed into CheckoutModal (`onExecutePayment`)
  const handleExecuteCheckoutPayment = async (
    order: CheckoutOrderRequest,
    paymentMethod: 'wallet' | 'mada' | 'card' | 'apple_pay'
  ): Promise<CheckoutExecutionResult> => {
    const activeUid =
      auth.currentUser?.uid ||
      userId ||
      resolvedCustomerUid ||
      `usr_${userEmail.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const fullName = [
      result.clientName,
      result.fatherName,
      result.grandfatherName,
      result.familyName,
    ]
      .filter((s) => s && s !== '—')
      .join(' ');
    const orderDocId = `ord_${activeUid.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)}`;

    const allCapsuleIds = (
      result.capsules?.length ? result.capsules : AL_MUQIT_8_CAPSULES
    ).map((c) => c.id);

    const operationType =
      order.type === 'unlock_root_5' || order.type === 'upgrade_basic'
        ? 'PURCHASE_ROOT_5USD'
        : order.type === 'upgrade_vip_60' || order.type === 'upgrade_premium'
        ? 'UPGRADE_ANNUAL_VIP'
        : order.type === 'wallet_topup'
        ? 'TOPUP'
        : 'UNLOCK_CAPSULE';

    const targetCapsuleIds =
      order.type === 'unlock_capsule' && order.capsuleId
        ? [order.capsuleId]
        : order.type === 'unlock_all_capsules_12'
        ? allCapsuleIds
        : undefined;

    const bonusWalletCreditUsd =
      order.type === 'upgrade_vip_60' ? order.bonusWalletUsd ?? 0 : 0;

    const atomicRes = await executeAtomicWalletOperation({
      userId: activeUid,
      userEmail,
      userFullName: fullName,
      operationType,
      amountUsd: order.amountUsd,
      paymentMethod: paymentMethod === 'wallet' ? 'wallet' : 'external',
      descriptionAr: order.title,
      targetCapsuleIds,
      bonusWalletCreditUsd,
    });

    if (atomicRes.status === 'INSUFFICIENT_FUNDS') {
      setWalletBalance(atomicRes.balanceBefore);
      setWalletShortfallUsd(atomicRes.shortfallUsd ?? null);
      return {
        status: 'INSUFFICIENT_FUNDS',
        shortfallUsd: atomicRes.shortfallUsd,
        balanceAfter: atomicRes.balanceBefore,
      };
    }

    setWalletBalance(atomicRes.balanceAfter);
    setWalletShortfallUsd(null);

    const txRef = atomicRes.transactionId || 'TXN-VERIFIED';
    const currentSnapshot = buildVerifiedLineageSnapshot(activeResult);

    const refreshUnlockedSnapshotFromEngine = () => {
      if (!activeResult.familyName) return;
      if (
        Array.isArray(activeResult.adamSpineNodes) &&
        activeResult.adamSpineNodes.length >= 2 &&
        activeResult.rootTribeName
      ) {
        return;
      }
      searchJuthoriLineage(
        {
          accountType,
          firstName: activeResult.clientName || editFirstName || 'عميل',
          fatherName: activeResult.fatherName || editFatherName || '',
          grandfatherName:
            activeResult.grandfatherName || editGrandfatherName || '',
          familyName: activeResult.familyName,
          originCountry: activeResult.originCountry || editOriginCountry,
          originRegion: activeResult.originRegion || editOriginRegion || '',
          tribeName: activeResult.rootTribeName || '',
          branchName: activeResult.rootBranchName || '',
          email: userEmail,
          password: '',
          agreedToTerms: true,
        },
        {
          ip_country: silentGeo.ip_country,
          ip_city: silentGeo.ip_city,
        }
      )
        .then((refreshed) => {
          if (!refreshed || !refreshed.matched) return;
          const mergedRefreshed: LineageSearchResult = {
            ...refreshed,
            clientName: activeResult.clientName || refreshed.clientName,
            fatherName: activeResult.fatherName || refreshed.fatherName,
            grandfatherName:
              activeResult.grandfatherName || refreshed.grandfatherName,
            requiresBlindDisambiguation:
              activeResult.requiresBlindDisambiguation === false
                ? false
                : refreshed.requiresBlindDisambiguation,
          };
          setVerifiedResultOverride(mergedRefreshed);
          if (onUpdateLineageResult) {
            onUpdateLineageResult(mergedRefreshed);
          }
          const snap = buildVerifiedLineageSnapshot(mergedRefreshed);
          updateUserProfile(activeUid, {
            verifiedLineageSnapshot: snap,
            lineageSnapshot: snap,
          }).catch(() => {});
        })
        .catch(() => {});
    };

    if (order.type === 'unlock_root_5' || order.type === 'upgrade_basic') {
      if (stateMode !== DashboardStateMode.AnnualVip) {
        onChangeStateMode(DashboardStateMode.State1Paid5Basic);
      }
      updateUserProfile(activeUid, {
        verifiedLineageSnapshot: currentSnapshot,
        lineageSnapshot: currentSnapshot,
      }).catch(() => {});
      refreshUnlockedSnapshotFromEngine();

      if (atomicRes.status === 'COMPLETED') {
        upsertCustomerOrderInFirebase({
          id: orderDocId,
          userId: activeUid,
          fullName,
          firstName: result.clientName,
          fatherName: result.fatherName || '—',
          grandfatherName: result.grandfatherName || '—',
          familyName: result.familyName,
          originCountry: result.originCountry,
          originRegion: result.originRegion || 'غير محدد',
          email: userEmail,
          phone: editPhone || '—',
          legalRole: accountType,
          accountStatus: 'paid_5_root',
          walletBalanceUsd: atomicRes.balanceAfter,
          paidRevenueUsd: order.amountUsd,
          matchStatus: !result.matched
            ? 'open_research_ticket'
            : result.isAlphaOnlyBeforeMerge
            ? 'staged_3_nodes'
            : 'auto_adam_full',
          ticketId: result.alphaBackgroundTicketCode || '—',
          ticketType: !result.matched
            ? 'طلب عميل P1'
            : result.isAlphaOnlyBeforeMerge
            ? 'إثراء شجرة آدم P2'
            : 'آلي مكتمل',
          assignedResearcher: 'مفتوح بالمنصة للباحثين',
          slaStatus: 'قيد العمل',
          nodesCountLabel: `${result.adamSpineNodes?.length || 1} محطة موثقة`,
        }).catch(() => {});
        appendActivity(
          `سداد ذري ناجح (${txRef}) — تفعيل باقة Basic (${formatPlanPriceUsd(order.amountUsd)})`,
          `تم فتح البحث الكامل عن ربط الجذور وعمود النسب + توسيع سعة شجرتي وخزانتي وخدمة العملاء`
        );
      }
    } else if (
      order.type === 'upgrade_vip_60' ||
      order.type === 'upgrade_premium'
    ) {
      onChangeStateMode(DashboardStateMode.AnnualVip);
      updateUserProfile(activeUid, {
        verifiedLineageSnapshot: currentSnapshot,
        lineageSnapshot: currentSnapshot,
      }).catch(() => {});
      refreshUnlockedSnapshotFromEngine();

      if (atomicRes.status === 'COMPLETED') {
        upsertCustomerOrderInFirebase({
          id: orderDocId,
          userId: activeUid,
          fullName,
          firstName: result.clientName,
          fatherName: result.fatherName || '—',
          grandfatherName: result.grandfatherName || '—',
          familyName: result.familyName,
          originCountry: result.originCountry,
          originRegion: result.originRegion || 'غير محدد',
          email: userEmail,
          phone: editPhone || '—',
          legalRole: accountType,
          accountStatus: 'annual_vip',
          walletBalanceUsd: atomicRes.balanceAfter,
          paidRevenueUsd: order.amountUsd,
          matchStatus: !result.matched
            ? 'open_research_ticket'
            : result.isAlphaOnlyBeforeMerge
            ? 'staged_3_nodes'
            : 'auto_adam_full',
          ticketId: result.alphaBackgroundTicketCode || '—',
          ticketType: !result.matched
            ? 'طلب عميل P1'
            : result.isAlphaOnlyBeforeMerge
            ? 'إثراء شجرة آدم P2'
            : 'آلي مكتمل',
          assignedResearcher: 'مفتوح بالمنصة للباحثين',
          slaStatus: 'قيد العمل',
          nodesCountLabel: `${result.adamSpineNodes?.length || 1} محطة موثقة`,
        }).catch(() => {});
        syncClientLineageTicketToFirebase({
          userId: activeUid,
          userFullName: fullName,
          userEmail,
          userPhone: editPhone,
          familyName: result.familyName,
          originCountry: result.originCountry,
          originRegion: result.originRegion,
          rootBranchName: result.rootBranchName,
          rootTribeName: result.rootTribeName,
          matched: result.matched,
          isAlphaOnlyBeforeMerge: result.isAlphaOnlyBeforeMerge,
          isAlphaMergedIntoAdam: result.isAlphaMergedIntoAdam,
          subscriptionTier: 'premium_annual',
          adamNodeId: result.adamNodeId,
          alphaBackgroundTicketCode: result.alphaBackgroundTicketCode,
          verifiedSources: result.verified_sources,
          corroboratingAlphaEvidence:
            result.corroborating_alpha_evidence_for_researcher,
          siblingBranches: result.sibling_branches_in_record,
          notablesInRecord: result.notables_in_record,
          enrichedLocations: result.enrichedLocations,
          adamSpineNodesCount: result.adamSpineNodes?.length || 1,
        })
          .then((created) => {
            if (created) setHasCustomerResearchTicket(true);
          })
          .catch(() => {});
        appendActivity(
          `سداد ذري ناجح (${txRef}) — تفعيل باقة Premium (${formatPlanPriceUsd(order.amountUsd)})`,
          'تم تفعيل جميع مزايا Basic بالإضافة إلى كشّافي (My Discoveries) ونشر موقع العائلة المستقل'
        );
      }
    } else if (order.type === 'unlock_capsule' && order.capsuleId) {
      const nextCapsules = unlockedCapsules.includes(order.capsuleId)
        ? unlockedCapsules
        : [...unlockedCapsules, order.capsuleId];
      setUnlockedCapsules(nextCapsules);
      updateUserProfile(activeUid, {
        verifiedLineageSnapshot: currentSnapshot,
        lineageSnapshot: currentSnapshot,
      }).catch(() => {});
      if (atomicRes.status === 'COMPLETED') {
        appendActivity(
          `سداد ناجح (${txRef}) — ${order.title}`,
          'تم فتح حلقة الأجداد الوسيطين بنجاح عبر السداد المباشر'
        );
      }
    } else if (order.type === 'unlock_all_capsules_12') {
      setUnlockedCapsules(allCapsuleIds);
      updateUserProfile(activeUid, {
        verifiedLineageSnapshot: currentSnapshot,
        lineageSnapshot: currentSnapshot,
      }).catch(() => {});
      if (atomicRes.status === 'COMPLETED') {
        appendActivity(
          `سداد ذري ناجح (${txRef}) — فتح حلقات الأجداد الوسيطين كاملة ($12)`,
          'تم فتح جميع حلقات الأجداد الوسيطين في شجرة آدم وتحويل كافة الروابط إلى «بن (سليل مباشر)»'
        );
      }
    }

    return {
      status: atomicRes.status,
      transactionId: txRef,
      balanceAfter: atomicRes.balanceAfter,
    };
  };

  // Callback executed when user clicks the final receipt button in CheckoutModal
  const handleConfirmCheckoutSuccess = (
    order: CheckoutOrderRequest,
    paymentMethod: 'wallet' | 'mada' | 'card' | 'apple_pay',
    invoiceNumber: string,
    alreadyExecutedAtomically?: boolean
  ) => {
    if (!alreadyExecutedAtomically) {
      handleExecuteCheckoutPayment(order, paymentMethod).catch(() => {});
    }
    void invoiceNumber;
    setActiveCheckoutOrder(null);
    setActiveUtilityDrawer(null);

    const pendingPrompt = pendingUpgradePromptRef.current;
    if (
      (order.type === 'upgrade_vip_60' ||
        order.type === 'upgrade_premium' ||
        order.type === 'upgrade_basic') &&
      pendingPrompt
    ) {
      const upgradedPlan =
        order.type === 'upgrade_basic' ? 'basic' : 'premium';
      const reqPlan = getRequiredPlanForFeature(pendingPrompt.feature);
      const needsCharter =
        pendingPrompt.feature === 'site_publish' ||
        pendingPrompt.feature === 'site_qr' ||
        pendingPrompt.feature === 'community_invite' ||
        pendingPrompt.feature === 'community_qr' ||
        pendingPrompt.feature === 'community_quest' ||
        pendingPrompt.feature === 'community_event';

      if (
        getPlanRank(upgradedPlan) >= getPlanRank(reqPlan) &&
        (!needsCharter || accountType === AccountLegalType.RecordKeeper)
      ) {
        const continueFn = pendingPrompt.onAuthorizedContinue;
        pendingUpgradePromptRef.current = null;
        setActiveUpgradePrompt(null);
        if (continueFn) {
          window.setTimeout(() => continueFn(), 120);
        }
      } else {
        // Stay on current tab and advance seamlessly to Step 2 (Registrar Charter Signature)
        setActiveUpgradePrompt(pendingPrompt);
      }
      return;
    }

    setActiveTab(DashboardTab.Lineage);
  };

  const requestPremiumAction = (req: UpgradePromptRequest) => {
    const reqPlan = req.requiredTier ?? getRequiredPlanForFeature(req.feature);
    const hasPlan =
      getPlanRank(caps.subscriptionPlan) >= getPlanRank(reqPlan);
    const needsCharter =
      req.feature === 'site_publish' || req.feature === 'site_qr';
    if (hasPlan && (!needsCharter || accountType === AccountLegalType.RecordKeeper)) {
      req.onAuthorizedContinue?.();
      return;
    }
    pendingUpgradePromptRef.current = req;
    setActiveUpgradePrompt({ ...req, requiredTier: reqPlan });
  };

  const handleTabClick = (tab: (typeof DASHBOARD_TABS)[number]) => {
    setActiveUtilityDrawer(null);
    setActiveTab(tab.id);
  };

  // Clicking "التوقيع الإلكتروني وتفعيل أمين السجل ✓" opens the full 29-Article Contract Modal
  const handleSignCharterAndOpenTree = () => {
    setShowCharterModal(true);
  };

  // Executed when the user checks the consent box and clicks "اعتماد التوقيع الإلكتروني وتفعيل أمين السجل الآن" inside RecordKeeperContractModal
  const handleConfirmRecordKeeperContractSignature =
    async (): Promise<LegalAuditTrailEntry> => {
      const activeUid =
        userId ||
        auth.currentUser?.uid ||
        resolvedCustomerUid ||
        `usr_${userEmail.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const fullName = [
        result.clientName,
        result.fatherName,
        result.grandfatherName,
        result.familyName,
      ]
        .filter((s) => s && s !== '—')
        .join(' ');
      const orderRef = `ORD-${activeUid.slice(-6).toUpperCase()}`;

      const auditEntry = await recordLegalAuditTrailInFirebase({
        userId: activeUid,
        userEmail: userEmail || 'user@juthori.com',
        userFullName:
          fullName || `${result.clientName} ${result.familyName}`.trim(),
        familyName: result.familyName,
        eventType: 'RECORD_KEEPER_CONTRACT_SIGNATURE',
        documentTitle: `${RECORD_KEEPER_CONTRACT_METADATA.mainTitle} ${RECORD_KEEPER_CONTRACT_METADATA.subTitle}`,
        documentVersion: RECORD_KEEPER_CONTRACT_VERSION,
        consentStatement:
          RECORD_KEEPER_CONTRACT_METADATA.finalConsentCheckboxLabel,
        ipAddress: silentGeo?.ip || '127.0.0.1',
        ipCountry: silentGeo?.ip_country || result.originCountry || 'السعودية',
        ipCity: silentGeo?.ip_city || result.originRegion || '',
        orderReference: orderRef,
        verificationMethod: 'electronic_contract_signature',
      });

      const registrarTx = await executeAtomicWalletOperation({
        userId: activeUid,
        userEmail,
        userFullName:
          fullName || `${result.clientName} ${result.familyName}`.trim(),
        operationType: 'UPGRADE_REGISTRAR',
        amountUsd: 0,
        paymentMethod: 'external',
        descriptionAr: `تفعيل عضوية وصلاحية أمين سجل عائلة (${result.familyName}) — شهادة العقد (${auditEntry.certificateCode})`,
        charterSignatureMeta: {
          signedAt: auditEntry.signedAtIso,
          charterCode: auditEntry.certificateCode,
          contractVersion: RECORD_KEEPER_CONTRACT_VERSION,
        },
      });

      onUpgradeAccountToRecordKeeper();

      await createCharterRequestInFirebase({
        userId: activeUid,
        clientName:
          fullName || `${result.clientName} ${result.familyName}`.trim(),
        familyName: result.familyName,
        email: userEmail,
        country: result.originCountry,
        status: 'معتمد (شجرتي مفعّلة)',
        charterCode: auditEntry.certificateCode,
        contractVersion: RECORD_KEEPER_CONTRACT_VERSION,
        ipAddress: auditEntry.ipAddress,
        auditTrailId: auditEntry.id,
      }).catch(() => {});

      upsertCustomerOrderInFirebase({
        id: orderRef,
        userId: activeUid,
        fullName:
          fullName || `${result.clientName} ${result.familyName}`.trim(),
        firstName: result.clientName,
        fatherName: result.fatherName || '—',
        grandfatherName: result.grandfatherName || '—',
        familyName: result.familyName,
        originCountry: result.originCountry,
        originRegion: result.originRegion || editOriginRegion || 'غير محدد',
        email: userEmail,
        phone: editPhone || '—',
        legalRole: 'record_keeper',
        accountStatus:
          stateMode === DashboardStateMode.AnnualVip
            ? 'annual_vip'
            : caps.isRootUnlocked
            ? 'paid_5_root'
            : 'free',
        walletBalanceUsd: registrarTx.balanceAfter,
        paidRevenueUsd:
          stateMode === DashboardStateMode.AnnualVip
            ? 60
            : caps.isRootUnlocked
            ? 5
            : 0,
        matchStatus: !result.matched
          ? 'open_research_ticket'
          : result.isAlphaOnlyBeforeMerge
          ? 'staged_3_nodes'
          : 'auto_adam_full',
        ticketId: result.alphaBackgroundTicketCode || '—',
        ticketType: !result.matched
          ? 'طلب عميل P1'
          : result.isAlphaOnlyBeforeMerge
          ? 'إثراء شجرة آدم P2'
          : 'آلي مكتمل',
        assignedResearcher: 'فريق التحقيق النَّسبي',
        slaStatus: 'مكتملة وتمت تغذية شجرة آدم',
        nodesCountLabel: `${result.adamSpineNodes?.length || 1} عقدة`,
      }).catch(() => {});

      setUserAuditTrail((prev) => [
        auditEntry,
        ...prev.filter((item) => item.id !== auditEntry.id),
      ]);

      setCharterSignedBanner({
        certificateCode: auditEntry.certificateCode,
        signedAt: auditEntry.signedAtFormatted,
      });

      appendActivity(
        `التوقيع الإلكتروني الموثق على عقد أمين السجل (${auditEntry.certificateCode})`,
        `اعتماد العقد الكامل (${RECORD_KEEPER_CONTRACT_VERSION}) وترقية الصفة القانونية إلى «أمين سجل العائلة» بسعة تصل إلى 250 فرداً`
      );

      return auditEntry;
    };

  const handleSelectVerificationPath = (
    optionId: 'option_a' | 'option_b' | 'option_c'
  ) => {
    const optIndex =
      optionId === 'option_b' ? 1 : optionId === 'option_c' ? 2 : 0;
    const chosenOpt =
      result.disambiguationOptions?.find((o) => o.id === optionId) ||
      result.disambiguationOptions?.[optIndex];
    const chosenCluster = result.consensusClusterGroups?.[optIndex];

    const explicitOverride =
      optionId === 'option_b'
        ? result.optionBResultOverride
        : optionId === 'option_c'
        ? result.optionCResultOverride
        : result.optionAResultOverride;

    const fallbackResolved = chosenOpt
      ? buildResolvedLineageFromDisambiguationOption(
          result,
          chosenOpt,
          chosenCluster
        )
      : null;

    const merged: LineageSearchResult =
      explicitOverride &&
      Array.isArray(explicitOverride.adamSpineNodes) &&
      explicitOverride.adamSpineNodes.length >= 2
        ? {
            ...result,
            ...explicitOverride,
            matched: true,
            requiresBlindDisambiguation: false,
          }
        : fallbackResolved
        ? {
            ...fallbackResolved,
            matched: true,
            requiresBlindDisambiguation: false,
          }
        : {
            ...result,
            matched: true,
            requiresBlindDisambiguation: false,
          };

    setVerifiedResultOverride(merged);
    if (onUpdateLineageResult) {
      onUpdateLineageResult(merged);
    }
    // IMPORTANT: Resolving the free verification question does NOT unlock the $5 root for free!
    // If the user is unpaid (State2MatchedUnpaid), they stay in State2MatchedUnpaid so the locked $5 Root card ("الجذر · افتح الآن $5") is now displayed.

    const activeUid =
      userId ||
      auth.currentUser?.uid ||
      `usr_${userEmail.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const fullName = [
      merged.clientName,
      merged.fatherName,
      merged.grandfatherName,
      merged.familyName,
    ]
      .filter((s) => s && s !== '—')
      .join(' ');
    const choiceLabel = `${merged.rootBranchName} ⬅️ ${merged.rootTribeName}`;

    // 1. Update parent profile & Firebase `users` with the customer's chosen tribe, branch, and region
    if (onUpdateProfileDetails) {
      onUpdateProfileDetails({
        firstName: merged.clientName || editFirstName,
        fatherName: merged.fatherName && merged.fatherName !== '—' ? merged.fatherName : editFatherName,
        grandfatherName:
          merged.grandfatherName && merged.grandfatherName !== '—'
            ? merged.grandfatherName
            : editGrandfatherName,
        familyName: merged.familyName,
        phone: editPhone,
        defaultCountry: editDefaultCountry,
        originCountry: merged.originCountry,
        originRegion: merged.originRegion || editOriginRegion,
        tribeName: merged.rootTribeName,
        branchName: merged.rootBranchName,
        avatarUrl,
      });
    }

    const resolvedChoiceId = chosenOpt?.choice_id || optionId;
    const mergedSnapshot = buildVerifiedLineageSnapshot(
      merged,
      resolvedChoiceId
    );

    updateUserProfile(activeUid, {
      tribeName: merged.rootTribeName,
      familyBranch: merged.rootBranchName,
      originCountry: merged.originCountry,
      originRegion: merged.originRegion || editOriginRegion,
      disambiguationChoiceId: resolvedChoiceId,
      verifiedLineageSnapshot: mergedSnapshot,
      lineageSnapshot: mergedSnapshot,
    }).catch(() => {});

    // 2. Sync customer's verified lineage ticket to Firebase `research_tickets` ONLY if Annual VIP
    if (stateMode === DashboardStateMode.AnnualVip) {
      syncClientLineageTicketToFirebase({
        userId: activeUid,
        userFullName: fullName,
        userEmail,
        userPhone: editPhone,
        familyName: merged.familyName,
        originCountry: merged.originCountry,
        originRegion: merged.originRegion,
        rootBranchName: merged.rootBranchName,
        rootTribeName: merged.rootTribeName,
        matched: merged.matched,
        isAlphaOnlyBeforeMerge: merged.isAlphaOnlyBeforeMerge,
        isAlphaMergedIntoAdam: merged.isAlphaMergedIntoAdam,
        subscriptionTier: 'premium_annual',
        adamNodeId: merged.adamNodeId,
        alphaBackgroundTicketCode: merged.alphaBackgroundTicketCode,
        verifiedSources: merged.verified_sources,
        corroboratingAlphaEvidence:
          merged.corroborating_alpha_evidence_for_researcher,
        siblingBranches: merged.sibling_branches_in_record,
        notablesInRecord: merged.notables_in_record,
        enrichedLocations: merged.enrichedLocations,
        adamSpineNodesCount: merged.adamSpineNodes?.length || 3,
        adamSpineNodes: merged.adamSpineNodes,
        fullStitchedLineage: merged.full_stitched_lineage_for_researcher,
        verificationChoiceLabel: choiceLabel,
        additionalNotes: `تم حسم سؤال التحقق المتدرج بواسطة العميل باختيار المسار القطعي: (${merged.familyName} ⬅️ ${merged.rootBranchName} ⬅️ ${merged.rootTribeName}) — النطاق الجغرافي: (${merged.originRegion || merged.originCountry}).`,
      }).catch(() => {});
    }

    // 3. Update customer order in Firebase `customer_orders`
    const orderDocId = `ORD-${activeUid.slice(-6).toUpperCase()}`;
    upsertCustomerOrderInFirebase({
      id: orderDocId,
      userId: activeUid,
      fullName,
      firstName: merged.clientName,
      fatherName: merged.fatherName || '—',
      grandfatherName: merged.grandfatherName || '—',
      familyName: merged.familyName,
      originCountry: merged.originCountry,
      originRegion: merged.originRegion || editOriginRegion || 'غير محدد',
      email: userEmail,
      phone: editPhone || '—',
      legalRole: accountType,
      accountStatus:
        stateMode === DashboardStateMode.AnnualVip
          ? 'annual_vip'
          : caps.isRootUnlocked
          ? 'paid_5_root'
          : 'free',
      walletBalanceUsd: walletBalance,
      paidRevenueUsd:
        stateMode === DashboardStateMode.AnnualVip
          ? 60
          : caps.isRootUnlocked
          ? 5
          : 0,
      matchStatus: merged.isAlphaOnlyBeforeMerge ? 'staged_3_nodes' : 'auto_adam_full',
      ticketId: merged.alphaBackgroundTicketCode || `ALP-ADAM-${merged.familyName}`,
      ticketType: merged.isAlphaOnlyBeforeMerge ? 'إثراء شجرة آدم P2' : 'آلي مكتمل',
      assignedResearcher: 'فريق التحقيق النَّسبي',
      slaStatus: 'قيد العمل',
      nodesCountLabel: `${merged.adamSpineNodes?.length || 3} محطة (${merged.rootBranchName} ⬅️ ${merged.rootTribeName})`,
    }).catch(() => {});

    // 4. If Port 8090 choice_id is present, also fetch deep server chain in background
    if (chosenOpt?.choice_id) {
      searchJuthoriLineage(
        {
          firstName: merged.clientName,
          fatherName: merged.fatherName || '',
          grandfatherName: merged.grandfatherName || '',
          familyName: merged.familyName,
          originCountry: merged.originCountry,
          originRegion: merged.originRegion || '',
          tribeName: merged.rootTribeName,
          branchName: merged.rootBranchName,
          accountType,
          email: userEmail,
          password: '',
          agreedToTerms: true,
        },
        {
          ip_country: silentGeo.ip_country,
          ip_city: silentGeo.ip_city,
        },
        chosenOpt.choice_id
      )
        .then((liveResolved) => {
          if (
            liveResolved &&
            liveResolved.matched &&
            Array.isArray(liveResolved.adamSpineNodes) &&
            liveResolved.adamSpineNodes.length > (merged.adamSpineNodes?.length || 0)
          ) {
            const finalLive: LineageSearchResult = {
              ...liveResolved,
              requiresBlindDisambiguation: false,
            };
            setVerifiedResultOverride(finalLive);
            if (onUpdateLineageResult) {
              onUpdateLineageResult(finalLive);
            }
            const liveSnap = buildVerifiedLineageSnapshot(
              finalLive,
              chosenOpt.choice_id
            );
            updateUserProfile(activeUid, {
              verifiedLineageSnapshot: liveSnap,
              lineageSnapshot: liveSnap,
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }

    appendActivity(
      'حسم سؤال التحقق المتدرج وفتح الجذر',
      `تم اعتماد مسار (${merged.rootBranchName} ⬅️ ${merged.rootTribeName}) لعائلة ${merged.familyName}`
    );
  };

  const handleEscalateVerificationToTicket = () => {
    const escalated: LineageSearchResult = {
      ...result,
      matched: false,
      requiresBlindDisambiguation: false,
      recommendedInitialState: DashboardStateMode.State3Unmatched,
    };
    setVerifiedResultOverride(escalated);
    if (onUpdateLineageResult) {
      onUpdateLineageResult(escalated);
    }
    onChangeStateMode(DashboardStateMode.State3Unmatched);

    const activeUid =
      userId ||
      auth.currentUser?.uid ||
      `usr_${userEmail.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const escalatedSnap = buildVerifiedLineageSnapshot(
      escalated,
      'not_sure_ticket'
    );
    updateUserProfile(activeUid, {
      disambiguationChoiceId: 'not_sure_ticket',
      verifiedLineageSnapshot: escalatedSnap,
      lineageSnapshot: escalatedSnap,
    }).catch(() => {});

    appendActivity(
      'تحديث حالة مطابقة العائلة',
      `طلب مراجعة مسار عائلة (${result.familyName})`
    );
  };

  // Load real Ambassador Time & Capacity rewards (`+25` seats per free invite up to `+100`, `+1` free month per paid subscriber)
  useEffect(() => {
    let active = true;
    const ownerName = `${result.clientName || ''} ${result.familyName || ''}`.trim();
    fetchUserReferralDashboard(resolvedCustomerUid, ownerName)
      .then((stats) => {
        if (!active) return;
        setAmbassadorCapacityBonus(stats.earnedCapacityBonus || 0);
        setAmbassadorFreeMonths(stats.earnedFreeMonths || 0);
      })
      .catch(() => {
        // Ignore gracefully when unauthenticated
      });
    return () => {
      active = false;
    };
  }, [resolvedCustomerUid, result.clientName, result.familyName, activeTab]);

  const effectiveTotalExtraTreeCapacity =
    extraTreeCapacity + ambassadorCapacityBonus;
  const activePlanShortBadgeLabel =
    caps.subscriptionPlan === 'premium'
      ? 'باقة بريميوم Premium'
      : caps.subscriptionPlan === 'basic'
      ? 'الباقة الأساسية Basic'
      : 'الباقة المجانية';

  const [pendingCircleJoinRequests, setPendingCircleJoinRequests] = useState<
    CircleJoinRequestDoc[]
  >([]);

  useEffect(() => {
    if (!resolvedCustomerUid) {
      setPendingCircleJoinRequests([]);
      return;
    }
    const unsub = subscribeToOwnerPendingJoinRequests(
      resolvedCustomerUid,
      (items) => {
        setPendingCircleJoinRequests(items);
      }
    );
    return () => unsub();
  }, [resolvedCustomerUid]);

  const unreadCount = notifications.filter((n) => n.unread).length;
  const bellBadgeCount = unreadCount + pendingCircleJoinRequests.length;

  // Separate user first name from family name cleanly for the Sculpted Profile Identity Capsule
  const cleanClientFirstName = (result.clientName || '').trim() || 'عضو جذوري';
  const rawClientFamilyName = (result.familyName || '').trim();
  const headerRoleLabel = resolveRoyalRoleLabel({
    accountType,
    hasRegistrarBadge: caps.hasRegistrarBadge,
    isVerifiedOrVip: caps.isVip || caps.isRootUnlocked,
  });

  const renderPrimaryNavigationTabs = (attachMobileRefs: boolean) => (
    <div className="inline-flex items-center gap-0.5 xl:gap-1 p-1 sm:p-1.5 xl:p-1 rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] shrink-0">
      {DASHBOARD_TABS.map((tab) => {
        const TabIcon = tab.icon;
        const isLocked = tab.premium && !caps.arePremiumTabsUnlocked;
        const isSelected = activeUtilityDrawer === null && activeTab === tab.id;
        const isKashafiTab = tab.id === DashboardTab.MyExplorer;
        const kashafiDynamicCount =
          kashafiUnreadItemsCount + (hasResearcherReplyWaiting ? 1 : 0);

        const buttonClasses = [
          'group/tab relative px-3 py-1.5 rounded-xl text-[12.5px] font-display font-bold inline-flex items-center justify-center gap-1.5 transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer min-h-[38px] xl:min-h-[36px] snap-center select-none border',
          isSelected
            ? 'bg-[#E8DED2]/60 text-[#D97757] border-[#D8C7B2]'
            : 'bg-transparent text-[#1F1F1C] border-transparent hover:border-[#D8C7B2]/65 hover:bg-[#E8DED2]/55 hover:text-[#1F1F1C]',
        ].join(' ');

        return (
          <button
            key={tab.id}
            ref={
              attachMobileRefs
                ? (el) => {
                    mobileTabRefs.current[tab.id] = el;
                  }
                : undefined
            }
            type="button"
            onClick={() => handleTabClick(tab)}
            aria-current={isSelected ? 'page' : undefined}
            title={
              isLocked
                ? `تبويب «${tab.label}» متاح لمشتركي الباقة السنوية (بريميوم)`
                : tab.label
            }
            className={buttonClasses}
          >
            <TabIcon
              className="w-[15px] h-[15px] shrink-0 text-[#D97757] transition-transform duration-200 group-hover/tab:scale-105"
              aria-hidden={true}
            />

            <span>{tab.label}</span>

            {isKashafiTab && kashafiDynamicCount > 0 && (
              <span
                data-testid="kashafi-tab-unread-badge"
                className="px-1.5 py-0.5 rounded-full font-mono tabular-nums text-[10px] font-extrabold leading-none bg-[#D97757] text-[#E8DED2]"
              >
                {kashafiDynamicCount}
              </span>
            )}

            {isSelected && (
              <span
                aria-hidden="true"
                className="absolute bottom-[3px] left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full bg-[#D97757]"
              />
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-[#F5F1E8] text-[#1F1F1C] overflow-x-clip">
      {/* A. PRECISION GRID-ALIGNED RTL LUXURY HEADER SHELL (Exact max-w-7xl parity with page content) */}
      <header className="relative md:sticky md:top-0 z-40 bg-[#F5F1E8] border-b border-[#D8C7B2] shadow-[0_8px_28px_-18px_rgba(31,31,28,0.14)]">
        {/* Subtle Architectural Islamic Arabesque & Lineage Vine SVG Watermark */}
        <DashboardHeaderWatermark />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* ============================================================== */}
          {/* RESPONSIVE PRECISION HEADER (100% Vertical Edge Alignment):    */}
          {/* • Desktop (>=1280px / xl): Single 76px row — Right Brand + Divider + 7-Tab Nav (flex-1) | Left Cart + Bell + Divider + Profile */}
          {/* • Tablet (768–1279px): Row 1 (Brand right + Account left) + Centered Row 2 (Single 7-Tab Nav)                                  */}
          {/* • Mobile (<768px): Compact h-14 Bar (Logo right + Mini Alerts & Compact Identity left)                                         */}
          {/* ============================================================== */}
          <div className="flex flex-wrap xl:flex-nowrap items-center justify-between gap-x-2.5 xl:gap-x-3 h-14 md:h-auto xl:h-[76px]">
            {/* 1. RIGHT BRAND ANCHOR (RTL START): Flush with right edge of page content */}
            <div className="order-1 flex items-center shrink-0 md:py-2.5 xl:py-0">
              <JuthoriLogo size="sm" onClick={onBackToLanding} confirmHomeNavigation />
            </div>

            {/* Golden Vertical Hairline between Brand & Primary 7-Tab Navigation (Desktop >= xl) */}
            <span
              aria-hidden="true"
              className="hidden xl:block xl:order-2 h-7 w-px bg-[#D97757]/25 shrink-0"
            />

            {/* 2. SINGLE PRIMARY 7-TAB NAVIGATION (Desktop >= xl: Right next to Logo + fills center gap | Tablet md..xl: Centered Row 2) */}
            <div className="hidden md:flex order-4 xl:order-3 w-full xl:w-auto xl:flex-1 border-t border-[#D8C7B2]/15 xl:border-t-0 py-2.5 xl:py-0 items-center justify-center xl:justify-start min-w-0">
              <nav
                aria-label="تبويبات لوحة تحكم العميل"
                className="flex items-center justify-center xl:justify-start min-w-0 max-w-full overflow-x-auto no-scrollbar"
              >
                {renderPrimaryNavigationTabs(false)}
              </nav>
            </div>

            {/* 3. LEFT UTILITY & PROFILE CLUSTER (RTL END): Cart + Bell + Divider + Profile */}
            <div className="order-2 xl:order-4 flex items-center gap-1.5 sm:gap-2 shrink-0 md:py-2.5 xl:py-0">
              {/* 3a. Subscription & Plan Cart Icon (RTL right of Notifications Bell) */}
              <button
                type="button"
                data-testid="header-subscription-cart-btn"
                onClick={() => {
                  setUserDropdownOpen(false);
                  setActiveUtilityDrawer((cur) =>
                    cur === 'cart' ? null : 'cart'
                  );
                }}
                title="باقتي وإدارة الاشتراك"
                aria-label="باقتي وإدارة الاشتراك"
                aria-pressed={activeUtilityDrawer === 'cart'}
                className={`group/util relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border transition-all duration-200 cursor-pointer shrink-0 ${
                  activeUtilityDrawer === 'cart'
                    ? 'bg-[#D97757] text-[#F5F1E8] border-[#D97757] shadow-xs ring-2 ring-[#D97757]/20'
                    : 'bg-[#F5F1E8]/85 border-[#D8C7B2]/45 text-[#D97757]/85 hover:bg-[#E8DED2]/75 hover:border-[#D97757]/50 hover:text-[#D97757]'
                }`}
              >
                <ShoppingCart
                  className="w-[17px] h-[17px] transition-transform duration-200 group-hover/util:scale-105"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
                <span
                  role="tooltip"
                  className="hidden md:block pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-[#FAF7F2] text-[#1F1F1C] border border-[#D8C7B2] text-[10.5px] font-display font-semibold whitespace-nowrap shadow-md opacity-0 translate-y-1 group-hover/util:opacity-100 group-hover/util:translate-y-0 transition-all duration-200 z-50"
                >
                  باقتي وإدارة الاشتراك
                </span>
              </button>

              {/* 3b. Notifications Bell (RTL top-left alert badge) */}
              <button
                type="button"
                onClick={() => {
                  setUserDropdownOpen(false);
                  setActiveUtilityDrawer((cur) =>
                    cur === 'notifications' ? null : 'notifications'
                  );
                  setNotifications((prev) =>
                    prev.map((n) => ({ ...n, unread: false }))
                  );
                }}
                title="الإشعارات والتنبيهات"
                aria-label="الإشعارات والتنبيهات"
                className={`group/util relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border transition-all duration-200 cursor-pointer shrink-0 ${
                  activeUtilityDrawer === 'notifications'
                    ? 'bg-[#D97757]/15 text-[#D97757] border-[#D97757]/35 shadow-2xs'
                    : bellBadgeCount > 0
                    ? 'bg-[#F5F1E8]/85 text-[#D97757] border-[#D8C7B2]/30 hover:bg-[#D97757]/12 hover:border-[#D97757]/50 hover:text-[#D97757]'
                    : 'bg-transparent border-transparent text-[#D97757]/75 hover:bg-[#D97757]/10 hover:text-[#D97757]'
                }`}
              >
                <Bell
                  className="w-[17px] h-[17px] transition-transform duration-200 group-hover/util:scale-105"
                  strokeWidth={1.55}
                  aria-hidden="true"
                />
                {bellBadgeCount > 0 && (
                  <span className="absolute -top-0.5 -left-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#D97757] text-[#F5F1E8] text-[9.5px] font-mono font-bold flex items-center justify-center tabular-nums ring-[1.5px] ring-[#F5F1E8] shadow-2xs">
                    {bellBadgeCount}
                  </span>
                )}
                <span
                  role="tooltip"
                  className="hidden md:block pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-[#FAF7F2] text-[#1F1F1C] border border-[#D8C7B2] text-[10.5px] font-display font-semibold whitespace-nowrap shadow-md opacity-0 translate-y-1 group-hover/util:opacity-100 group-hover/util:translate-y-0 transition-all duration-200 z-50"
                >
                  الإشعارات
                </span>
              </button>

              {/* 3c. Delicate Vertical Hairline Separating Utility Icons & Profile Capsule */}
              <span
                aria-hidden="true"
                className="hidden sm:block h-6 w-px bg-[#D97757]/20 shrink-0"
              />

              {/* 3d. COMPACT PROFILE IDENTITY CAPSULE (Flush Far-Left Anchor) */}
              <div className="relative shrink-0" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen((prev) => !prev)}
                  aria-expanded={userDropdownOpen}
                  aria-haspopup="menu"
                  aria-label="قائمة الحساب الشخصي والأدوات"
                  className={`group relative overflow-hidden w-auto shrink-0 flex items-center gap-2 rounded-2xl px-2 py-1 border transition-all duration-200 ease-out cursor-pointer text-right ${
                    userDropdownOpen
                      ? 'bg-[#E8DED2]/70 border-[#D97757]/60 shadow-[0_6px_18px_-10px_rgba(217,119,87,0.3)]'
                      : 'bg-[#F5F1E8] border-[#D8C7B2] shadow-[0_1px_6px_-3px_rgba(31,31,28,0.08)] hover:bg-[#E8DED2]/50 hover:border-[#D97757]/55'
                  }`}
                >
                  {/* Rightmost (RTL Start): Clean Warm Default Avatar Icon (No Black Background) */}
                  <span className="relative shrink-0">
                    <span className="w-8 h-8 rounded-full bg-[#E8DED2] text-[#D97757] border border-[#D8C7B2] flex items-center justify-center overflow-hidden shadow-2xs">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={`${cleanClientFirstName} ${rawClientFamilyName}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserRound
                          className="w-4 h-4 text-[#D97757]"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      )}
                    </span>

                    {caps.isVip && (
                      <span
                        title="عضوية بريميوم"
                        aria-label="عضوية بريميوم"
                        data-testid="header-profile-premium-crown"
                        className="absolute -bottom-0.5 -left-0.5 w-[13px] h-[13px] rounded-full bg-[#F5F1E8] border border-[#D97757] text-[#D97757] shadow-2xs flex items-center justify-center"
                      >
                        <Crown className="w-2 h-2 stroke-[2.2]" aria-hidden="true" />
                      </span>
                    )}
                  </span>

                  {/* Middle: Compact Stacked Customer Name + Smaller Outlined Role Badge & Family Name */}
                  <div
                    data-testid="header-royal-role-family-badge"
                    className="relative z-10 hidden sm:flex flex-col items-start justify-center gap-1 leading-none min-w-0 py-0.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11.5px] font-display font-bold text-[#1F1F1C] leading-none whitespace-nowrap">
                        {cleanClientFirstName}
                      </span>
                      <span className="px-1.5 py-[2px] rounded-md bg-transparent border border-[#D97757] text-[#D97757] text-[8.5px] font-display font-bold leading-none whitespace-nowrap">
                        {headerRoleLabel}
                      </span>
                    </div>

                    {formatRoyalFamilyLabel(result.familyName) && (
                      <span className="text-[9.5px] font-display font-semibold text-[#1F1F1C] leading-none whitespace-nowrap">
                        {formatRoyalFamilyLabel(result.familyName)}
                      </span>
                    )}
                  </div>

                  {/* Trailing Left Edge: Compact Chevron */}
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[#D97757]/80 shrink-0 transition-transform duration-200 ${
                      userDropdownOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {/* UNIFIED PROFILE & TOOLS DROPDOWN MENU (Left-anchored for far-left RTL trigger) */}
                {userDropdownOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 mt-2.5 w-[336px] sm:w-[356px] max-w-[calc(100vw-1.5rem)] rounded-2xl bg-[#F5F1E8]/98 backdrop-blur-md border border-[#D8C7B2]/35 shadow-[0_24px_56px_-16px_rgba(31,31,28,0.24)] py-2 z-50 text-right overflow-hidden"
                  >
                    {/* Dropdown Identity Header: Dedicated Full Name Row + Shared Royal Badge + Status Chips + Email */}
                    <div className="px-4 py-3.5 bg-gradient-to-l from-[#F5F1E8] to-[#E8DED2]/80 border-b border-[#D8C7B2]/20 space-y-2.5">
                      <div className="font-display font-extrabold text-[15px] text-[#1F1F1C] leading-relaxed break-words">
                        {result.clientName}
                        {result.fatherName && result.fatherName !== '—'
                          ? ` بن ${result.fatherName}`
                          : ''}{' '}
                        {result.familyName}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <RoyalRoleFamilyBadge
                          roleLabel={headerRoleLabel}
                          familyName={result.familyName}
                          variant="header"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-[1px] rounded-full border text-[9.5px] font-display font-bold leading-normal ${
                              caps.subscriptionPlan === 'premium'
                                ? 'bg-transparent border-[#D97757] text-[#D97757]'
                                : caps.subscriptionPlan === 'basic'
                                ? 'bg-[#FAF7F2] border-[#D97757]/60 text-[#1F1F1C]'
                                : 'bg-[#FAF7F2] border-[#D8C7B2] text-[#1F1F1C]/80'
                            }`}
                          >
                            {caps.subscriptionPlan === 'premium' && (
                              <Crown className="w-2.5 h-2.5 text-[#D97757]" />
                            )}
                            <span>{activePlanShortBadgeLabel}</span>
                          </span>
                          {isEmailVerified ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F5F1E8] border border-[#D8C7B2] text-[#1F1F1C] text-[10.5px] font-bold leading-normal">
                              <CheckCircle2 className="w-3 h-3 text-[#D97757]" />
                              <span>موثّق ✓</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F5F1E8] border border-[#D8C7B2] text-[#1F1F1C] text-[10.5px] font-bold leading-normal">
                              <span>غير موثّق</span>
                            </span>
                          )}
                        </div>

                        <div
                          className="text-[11.5px] font-mono text-[#1F1F1C]/70 truncate max-w-full"
                          dir="ltr"
                        >
                          {userEmail}
                        </div>
                      </div>
                    </div>

                    {/* Primary Account & Family Record Items */}
                    <div className="py-1.5 px-2 space-y-0.5">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setActiveUtilityDrawer('profile');
                        }}
                        className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F1E8] flex items-center gap-3 text-right transition-colors cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#E8DED2] text-[#D97757] flex items-center justify-center shrink-0">
                          <User className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-display font-bold text-[#1F1F1C]">
                            الملف الشخصي
                          </div>
                          <div className="text-[11px] text-[#1F1F1C]/65 truncate">
                            تعديل البيانات، الصورة، الجوال، والدولة
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setActiveUtilityDrawer('cart');
                        }}
                        className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F1E8] flex items-center gap-3 text-right transition-colors cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#E8DED2] text-[#D97757] flex items-center justify-center shrink-0">
                          <Crown className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-display font-bold text-[#1F1F1C]">
                              باقتي وإدارة الاشتراك
                            </span>
                            <span className="text-[10px] font-display font-bold px-2 py-0.5 rounded-full bg-[#FAF7F2] border border-[#D8C7B2] text-[#D97757] shrink-0">
                              {SUBSCRIPTION_PLANS[caps.subscriptionPlan].code}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#1F1F1C]/65 truncate">
                            استعراض مزايا باقتك الحالية، الترقية الشهريّة أو السنويّة، وسجل الفواتير
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setShowCharterModal(true);
                        }}
                        className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F1E8] flex items-center gap-3 text-right transition-colors cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#E8DED2] text-[#D97757] flex items-center justify-center shrink-0">
                          <FileSignature className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-display font-bold text-[#1F1F1C]">
                              ميثاق أمين السجل
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-transparent border border-[#D97757] text-[#D97757]">
                              {accountType === AccountLegalType.RecordKeeper
                                ? 'مفعّل ✓'
                                : 'حساب فرد'}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#1F1F1C]/65 truncate">
                            حالة الصفة القانونية لبناء الشجرة
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setActiveUtilityDrawer(null);
                          setActiveTab(DashboardTab.ResearchTickets);
                        }}
                        className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F1E8] flex items-center gap-3 text-right transition-colors cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#E8DED2] text-[#D97757] flex items-center justify-center shrink-0">
                          <Scroll className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-display font-bold text-[#1F1F1C]">
                              مرصد البحوث ومراسلات النسب
                            </span>
                            {hasResearcherReplyWaiting ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C]">
                                رد جديد
                              </span>
                            ) : hasCustomerResearchTicket ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F5F1E8] border border-[#D97757]/40 text-[#D97757]">
                                قيد المتابعة
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[11px] text-[#1F1F1C]/65 truncate">
                            متابعة حالة تحقيق النسب والرد على الباحثين
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Integrated Secondary Tools Section (Settings, Activity Log, Help, Language) */}
                    <div className="py-1.5 px-2 border-t border-[#D8C7B2]/20 space-y-0.5">
                      <div className="px-3 pt-1 pb-0.5 text-[10px] font-display font-bold text-[#D97757] tracking-wide">
                        الأدوات والتفضيلات
                      </div>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setActiveUtilityDrawer('settings');
                        }}
                        className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F1E8] flex items-center gap-3 text-right transition-colors cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-lg bg-[#E8DED2] text-[#D97757] flex items-center justify-center shrink-0">
                          <Settings className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-display font-bold text-[#1F1F1C]">
                            الإعدادات العامة والأمان
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setActiveUtilityDrawer((cur) =>
                            cur === 'activity' ? null : 'activity'
                          );
                        }}
                        className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F1E8] flex items-center gap-3 text-right transition-colors cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-lg bg-[#E8DED2] text-[#D97757] flex items-center justify-center shrink-0">
                          <Activity className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-display font-bold text-[#1F1F1C]">
                            سجل النشاط
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setActiveUtilityDrawer((cur) =>
                            cur === 'help' ? null : 'help'
                          );
                        }}
                        className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F1E8] flex items-center gap-3 text-right transition-colors cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-lg bg-[#E8DED2] text-[#D97757] flex items-center justify-center shrink-0">
                          <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-display font-bold text-[#1F1F1C]">
                            المساعدة والإرشاد
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setBilingualLabels((v) => !v);
                        }}
                        className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F1E8] flex items-center justify-between gap-2 text-right transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-[#E8DED2] text-[#D97757] flex items-center justify-center shrink-0">
                            <Languages className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </span>
                          <span className="text-xs font-display font-bold text-[#1F1F1C]">
                            تغيير اللغة
                          </span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#F5F1E8] border border-[#D97757]/40 text-[10px] font-mono font-bold text-[#D97757] shrink-0">
                          {bilingualLabels ? 'AR / EN' : 'العربية'}
                        </span>
                      </button>
                    </div>

                    {/* Logout Action at Bottom of Dropdown */}
                    {onLogout && (
                      <div className="pt-1.5 mt-0.5 border-t border-[#D8C7B2]/20 px-2 pb-1">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            onLogout();
                          }}
                          className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F1E8] text-[#D97757] flex items-center gap-3 text-right transition-colors cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-lg bg-[#E8DED2]/80 text-[#D97757] flex items-center justify-center shrink-0">
                            <LogOut className="w-3.5 h-3.5" />
                          </div>
                          <div className="text-xs font-display font-bold">
                            تسجيل الخروج
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE STICKY GLASS TOUCH NAVIGATION BAR (< 768px): Effortless One-Handed Access & Auto-Centered Active Tab */}
      <div
        data-testid="mobile-sticky-touch-nav"
        className="md:hidden sticky top-0 z-30 bg-[#F5F1E8] border-b border-[#D8C7B2] shadow-[0_8px_22px_-12px_rgba(31,31,28,0.14)]"
      >
        <div className="relative px-2 py-2">
          {/* Soft Side Gradient Fades Indicating Horizontal Continuation */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-7 bg-gradient-to-r from-[#F5F1E8] via-[#F5F1E8]/80 to-transparent z-10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-[#F5F1E8] via-[#F5F1E8]/80 to-transparent z-10"
          />

          <nav
            aria-label="تبويبات لوحة تحكم العميل للجوال"
            className="w-full flex items-center overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth touch-pan-x px-1"
          >
            {renderPrimaryNavigationTabs(true)}
          </nav>
        </div>
      </div>

      {/* MAIN DASHBOARD WORKSPACE (100% Exact Horizontal & Vertical Edge Parity with Header) */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeUtilityDrawer !== null ? (
          <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/45 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#D97757]/25">
              <div>
                <p className="text-xs font-semibold text-[#D97757] mb-1">
                  {activeUtilityDrawer === 'profile' &&
                    'الملف الشخصي والبيانات العائلية والجغرافية'}
                  {activeUtilityDrawer === 'settings' &&
                    'إعدادات الحساب والأمان والخصوصية'}
                  {activeUtilityDrawer === 'cart' &&
                    'مركز إدارة الاشتراك والفواتير ومكافآت السفير'}
                  {activeUtilityDrawer === 'notifications' &&
                    'التنبيهات والتحديثات الأرشيفية'}
                  {activeUtilityDrawer === 'activity' && 'الأرشيف الزمني للعمليات'}
                  {activeUtilityDrawer === 'help' && 'الدعم والإرشاد المعرفي'}
                </p>
                <h1 className="text-xl sm:text-2xl font-display font-bold text-[#1F1F1C]">
                  {activeUtilityDrawer === 'profile' &&
                    'الملف الشخصي والبيانات الجغرافية وصورة الحساب'}
                  {activeUtilityDrawer === 'settings' &&
                    'إعدادات الحساب والأمان والإشعارات'}
                  {activeUtilityDrawer === 'cart' && 'باقتي وإدارة الاشتراك'}
                  {activeUtilityDrawer === 'notifications' &&
                    'مركز الإشعارات والتنبيهات النسبية'}
                  {activeUtilityDrawer === 'activity' &&
                    'نشاط السجل والتوثيق الزمني'}
                  {activeUtilityDrawer === 'help' && 'مركز مساعدة لوحة تحكم العميل'}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                {(activeUtilityDrawer === 'profile' ||
                  activeUtilityDrawer === 'settings') && (
                  <div className="inline-flex rounded-xl bg-[#F5F1E8] p-1 border border-[#D97757]/35">
                    <button
                      type="button"
                      onClick={() => setActiveUtilityDrawer('profile')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-colors cursor-pointer ${
                        activeUtilityDrawer === 'profile'
                          ? 'bg-[#D97757] text-[#F5F1E8]'
                          : 'text-[#1F1F1C]/75 hover:text-[#1F1F1C]'
                      }`}
                    >
                      👤 الملف الشخصي
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveUtilityDrawer('settings')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-colors cursor-pointer ${
                        activeUtilityDrawer === 'settings'
                          ? 'bg-[#D97757] text-[#F5F1E8]'
                          : 'text-[#1F1F1C]/75 hover:text-[#1F1F1C]'
                      }`}
                    >
                      ⚙️ الأمان والإعدادات
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setActiveUtilityDrawer(null)}
                  className="px-4 py-2 rounded-xl bg-[#E8DED2] hover:bg-[#D97757] hover:text-[#F5F1E8] text-[#1F1F1C] text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  <span>
                    العودة إلى{' '}
                    {DASHBOARD_TABS.find((t) => t.id === activeTab)?.label ||
                      'عمود نسبي'}
                  </span>
                </button>
              </div>
            </div>

            {/* ============================================================ */}
            {/* 1. DEDICATED PROFILE VIEW (الملف الشخصي فقط)                  */}
            {/* ============================================================ */}
            {activeUtilityDrawer === 'profile' && (
              <div className="space-y-8">
                {/* 1. Avatar Upload Card */}
                <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/45 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 rounded-full bg-[#E8DED2] text-[#D97757] flex items-center justify-center overflow-hidden border-2 border-[#D8C7B2] shadow-sm shrink-0">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={result.clientName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserRound className="w-9 h-9 text-[#D97757]" strokeWidth={1.85} />
                      )}
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-base sm:text-lg font-display font-bold text-[#1F1F1C]">
                        1. تغيير وإرفاق صورة الحساب الشخصية
                      </h2>
                      <p className="text-xs text-[#1F1F1C]/75 leading-relaxed max-w-xl">
                        تُحفظ صورتك في Firebase وتظهر تلقائياً في كبسولة الهيدر العلوية، وفي عقدة «أمين السجل» داخل عمود نسبي، وفي عقدة «أمين السجل» داخل شجرتي.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <label className="px-4 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer shadow-xs">
                      <Camera className="w-4 h-4" />
                      <span>
                        {isUploadingAvatar
                          ? 'جاري الرفع والحفظ...'
                          : 'رفع صورة شخصية جديدة'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* 2. Personal & Geographic Data Form */}
                <form
                  onSubmit={handleSaveProfileData}
                  className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/40 p-5 sm:p-6 space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D97757]/25 pb-3.5">
                    <div>
                      <h2 className="text-base sm:text-lg font-display font-bold text-[#1F1F1C]">
                        2. تعديل البيانات الشخصية والجغرافية
                      </h2>
                      <p className="text-xs text-[#1F1F1C]/70">
                        تحديث الاسم الثلاثي، رقم الجوال، ودولة الإقامة في حسابك (بيانات اسم العائلة والموطن الأصلي مثبتة لارتباطها بالجذر الموثق)
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        dir="ltr"
                        className="px-2.5 py-1 rounded-lg bg-[#F5F1E8] border border-[#D97757]/35 text-[11px] font-mono text-[#D97757]"
                      >
                        {userEmail}
                      </span>
                      {isEmailVerified ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] text-[11px] font-extrabold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#D97757]" />
                          <span>بريد موثّق ✓</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveUtilityDrawer('settings')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          <span>توثيق البريد في الأمان والإعدادات</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                        الاسم الأول *
                      </label>
                      <input
                        type="text"
                        required
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        className="w-full rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 px-3.5 py-2.5 text-sm text-[#1F1F1C]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                        اسم الأب
                      </label>
                      <input
                        type="text"
                        value={editFatherName}
                        onChange={(e) => setEditFatherName(e.target.value)}
                        placeholder="اختياري"
                        className="w-full rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 px-3.5 py-2.5 text-sm text-[#1F1F1C]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                        اسم الجد
                      </label>
                      <input
                        type="text"
                        value={editGrandfatherName}
                        onChange={(e) => setEditGrandfatherName(e.target.value)}
                        placeholder="اختياري"
                        className="w-full rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 px-3.5 py-2.5 text-sm text-[#1F1F1C]"
                      />
                    </div>

                    <div>
                      <label className="flex items-center justify-between gap-1 text-xs font-bold text-[#1F1F1C]/80 mb-1.5">
                        <span>اسم العائلة / الشهرة *</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#D97757]">
                          <Lock className="w-3 h-3" />
                          <span>مرتبط بالجذر</span>
                        </span>
                      </label>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={
                          activeResult.familyName ||
                          result.familyName ||
                          editFamilyName
                        }
                        title="غير قابل للتعديل لأنه معتمد في عملية الربط بالجذر والمطابقة"
                        className="w-full rounded-xl bg-[#E8DED2]/75 border border-[#D97757]/40 px-3.5 py-2.5 text-sm font-semibold text-[#1F1F1C]/70 cursor-not-allowed select-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                        رقم الجوال (للتواصل والإشعارات)
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          dir="ltr"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="+966 5X XXX XXXX"
                          className="w-full rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 px-3.5 py-2.5 pl-9 text-right text-sm text-[#1F1F1C]"
                        />
                        <Phone className="w-4 h-4 text-[#D97757] absolute left-3 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1F1F1C] mb-1.5">
                        دولة الإقامة
                      </label>
                      <select
                        value={editDefaultCountry}
                        onChange={(e) => setEditDefaultCountry(e.target.value)}
                        className="w-full rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 px-3.5 py-2.5 text-sm text-[#1F1F1C]"
                      >
                        {ORIGIN_COUNTRY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="flex items-center justify-between gap-1 text-xs font-bold text-[#1F1F1C]/80 mb-1.5">
                        <span>الموطن الأصلي للعائلة (الدولة والإقليم)</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#D97757]">
                          <Lock className="w-3 h-3" />
                          <span>مرتبط بالجذر</span>
                        </span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          readOnly
                          disabled
                          value={
                            activeResult.originCountry ||
                            result.originCountry ||
                            editOriginCountry
                          }
                          title="غير قابل للتعديل لأنه معتمد في عملية الربط بالجذر والمطابقة"
                          className="w-full rounded-xl bg-[#E8DED2]/75 border border-[#D97757]/40 px-2.5 py-2.5 text-xs font-semibold text-[#1F1F1C]/70 cursor-not-allowed select-none"
                        />
                        <input
                          type="text"
                          readOnly
                          disabled
                          value={
                            initialOriginRegion ||
                            activeResult.originRegion ||
                            result.originRegion ||
                            editOriginRegion ||
                            '—'
                          }
                          title="غير قابل للتعديل لأنه معتمد في عملية الربط بالجذر والمطابقة"
                          className="w-full rounded-xl bg-[#E8DED2]/75 border border-[#D97757]/40 px-2.5 py-2.5 text-xs font-semibold text-[#1F1F1C]/70 cursor-not-allowed select-none"
                        />
                      </div>
                    </div>
                  </div>

                  {profileSaveFeedback && (
                    <div
                      className={`rounded-xl px-4 py-2.5 text-xs font-bold flex items-center gap-2 ${
                        profileSaveFeedback.startsWith('تعذر')
                          ? 'bg-[#F5F1E8] border border-[#D8C7B2] text-[#1F1F1C]'
                          : 'bg-[#F5F1E8] border border-[#D8C7B2] text-[#1F1F1C]'
                      }`}
                    >
                      {profileSaveFeedback.startsWith('تعذر') ? (
                        <AlertCircle className="w-4 h-4 text-[#D97757] shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-[#D97757] shrink-0" />
                      )}
                      <span>{profileSaveFeedback}</span>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="px-6 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs sm:text-sm font-display font-bold transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {isSavingProfile
                        ? 'جاري الحفظ في Firebase...'
                        : 'حفظ البيانات الشخصية والجغرافية'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ============================================================ */}
            {/* 2. DEDICATED SECURITY & SETTINGS VIEW (الأمان والإعدادات فقط) */}
            {/* ============================================================ */}
            {activeUtilityDrawer === 'settings' && (
              <div className="space-y-8">
                {/* Thin, Calm, Dismissible Email Verification Reminder Banner */}
                {!isEmailVerified && !dismissedEmailBannerInProfile && (
                  <div className="rounded-xl bg-[#F5F1E8] border border-[#D97757]/45 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#1F1F1C]">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#D97757] shrink-0" />
                      <span>
                        تذكير هادئ: يمكنك توثيق بريدك الإلكتروني (<strong className="font-mono">{userEmail}</strong>) أدناه لتعزيز أمان حسابك وتفعيل النشر العام في «موقعي».
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={
                          isSendingVerificationOtp ||
                          verificationResendCooldown > 0
                        }
                        onClick={handleSendEmailVerificationCode}
                        className="px-3 py-1 rounded-lg bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-[11px] font-display font-bold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isSendingVerificationOtp
                          ? 'جاري الإرسال...'
                          : verificationResendCooldown > 0
                          ? `إعادة الإرسال (${verificationResendCooldown}ث)`
                          : 'إرسال رمز التوثيق'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDismissedEmailBannerInProfile(true)}
                        aria-label="إغلاق التذكير"
                        className="p-1 rounded-lg hover:bg-[#E8DED2] text-[#1F1F1C]/65 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* 1. Non-Blocking Server-Side Email Verification Card (Resend OTP) */}
                <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/45 p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Mail className="w-4 h-4 text-[#D97757]" />
                        <h2 className="text-sm sm:text-base font-display font-extrabold text-[#1F1F1C]">
                          1. حالة وتوثيق البريد الإلكتروني المرتبط بالحساب
                        </h2>
                        <span
                          dir="ltr"
                          className="px-2.5 py-0.5 rounded-lg bg-[#F5F1E8] border border-[#D97757]/35 text-xs font-mono text-[#D97757]"
                        >
                          {userEmail}
                        </span>
                        {isEmailVerified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] text-[11px] font-extrabold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#D97757]" />
                            <span>موثّق ✓</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F5F1E8] border border-[#D8C7B2] text-[#1F1F1C] text-[11px] font-bold">
                            <span>غير موثّق</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#1F1F1C]/70">
                        {isEmailVerified
                          ? `البريد الإلكتروني موثّق ومعتمد رسمياً${
                              emailVerifiedAt
                                ? ` منذ ${new Date(emailVerifiedAt).toLocaleDateString('ar-SA')}`
                                : ''
                            } — النشر العام وإيصالات الفوترة مفعّلان بالكامل.`
                          : 'التوثيق اختياري ولا يعيق استخدامك لشجرتي أو خزانتي أو عمود النسب، ويُطلب فقط قبل النشر العام في «موقعي» (يُرسل الرمز عبر: منصة جذوري · info@Juthori.com).'}
                      </p>
                    </div>

                    {!isEmailVerified && (
                      <button
                        type="button"
                        disabled={
                          isSendingVerificationOtp ||
                          verificationResendCooldown > 0
                        }
                        onClick={handleSendEmailVerificationCode}
                        className="px-4 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer shrink-0 disabled:opacity-55"
                      >
                        {isSendingVerificationOtp ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {isSendingVerificationOtp
                            ? 'جاري إرسال الرمز...'
                            : verificationResendCooldown > 0
                            ? `إعادة الإرسال بعد (${verificationResendCooldown}ث)`
                            : 'إرسال رمز التوثيق'}
                        </span>
                      </button>
                    )}
                  </div>

                  {!isEmailVerified && verificationOtpSent && (
                    <form
                      onSubmit={handleVerifyEmailOtpCode}
                      className="pt-3 border-t border-[#D97757]/25 flex flex-col sm:flex-row sm:items-center gap-2.5"
                    >
                      <input
                        type="text"
                        inputMode="numeric"
                        dir="ltr"
                        maxLength={6}
                        value={verificationOtpInput}
                        onChange={(e) =>
                          setVerificationOtpInput(
                            e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
                          )
                        }
                        placeholder="أدخل الرمز المكون من 6 أرقام"
                        className="sm:w-64 rounded-xl bg-[#F5F1E8] border border-[#D97757]/55 px-4 py-2 text-center font-mono text-sm tracking-widest text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                      />
                      <button
                        type="submit"
                        disabled={isVerifyingOtpCode}
                        className="px-5 py-2 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                      >
                        {isVerifyingOtpCode ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>تأكيد رمز التوثيق</span>
                      </button>
                    </form>
                  )}

                  {verificationFeedback && (
                    <div
                      role="status"
                      className={`rounded-xl px-4 py-3 text-xs font-semibold flex items-start gap-2.5 leading-relaxed ${
                        verificationFeedback.type === 'success'
                          ? 'bg-[#F5F1E8] border border-[#D8C7B2] text-[#1F1F1C]'
                          : verificationFeedback.type === 'diagnostic'
                          ? 'bg-[#F5F1E8] border border-[#D8C7B2] text-[#1F1F1C]'
                          : 'bg-[#F5F1E8] border border-[#D8C7B2] text-[#1F1F1C]'
                      }`}
                    >
                      {verificationFeedback.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-[#D97757] shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-[#D97757] shrink-0 mt-0.5" />
                      )}
                      <span>{verificationFeedback.text}</span>
                    </div>
                  )}
                </div>

                {/* 2. Security & Password Change + 3. Notification Preferences */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 2. Security & Password Change */}
                  <form
                    onSubmit={handleChangePassword}
                    className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/40 p-5 sm:p-6 space-y-4"
                  >
                    <div className="flex items-center gap-2.5 border-b border-[#D97757]/25 pb-3">
                      <KeyRound className="w-5 h-5 text-[#D97757]" />
                      <div>
                        <h2 className="text-base font-display font-bold text-[#1F1F1C]">
                          2. الأمان وتغيير كلمة المرور
                        </h2>
                        <p className="text-xs text-[#1F1F1C]/70">
                          تحديث كلمة مرور حسابك في Firebase Authentication
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {!isGoogleOnlyPasswordlessSession && (
                        <div>
                          <label className="block text-xs font-bold text-[#1F1F1C] mb-1">
                            كلمة المرور الحالية *
                          </label>
                          <input
                            type="password"
                            dir="ltr"
                            autoComplete="current-password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="أدخل كلمة المرور الحالية للتحقق"
                            className="w-full rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 px-3.5 py-2 text-right text-sm text-[#1F1F1C]"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-[#1F1F1C] mb-1">
                          كلمة المرور الجديدة *
                        </label>
                        <input
                          type="password"
                          dir="ltr"
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="6 خانات على الأقل"
                          className="w-full rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 px-3.5 py-2 text-right text-sm text-[#1F1F1C]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#1F1F1C] mb-1">
                          تأكيد كلمة المرور الجديدة *
                        </label>
                        <input
                          type="password"
                          dir="ltr"
                          autoComplete="new-password"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder="أعد كتابة كلمة المرور الجديدة"
                          className="w-full rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 px-3.5 py-2 text-right text-sm text-[#1F1F1C]"
                        />
                      </div>
                    </div>

                    {passwordFeedback && (
                      <div
                        className={`rounded-xl px-3.5 py-2.5 text-xs font-bold flex items-start gap-2 ${
                          passwordFeedback.type === 'success'
                            ? 'bg-[#F5F1E8] border border-[#D8C7B2] text-[#1F1F1C]'
                            : 'bg-[#F5F1E8] border border-[#D8C7B2] text-[#D97757]'
                        }`}
                      >
                        {passwordFeedback.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-[#D97757] shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-[#D97757] shrink-0 mt-0.5" />
                        )}
                        <span>{passwordFeedback.text}</span>
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={isChangingPassword}
                        className="px-5 py-2 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                      >
                        {isChangingPassword && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        )}
                        <span>
                          {isChangingPassword
                            ? 'جاري تحديث كلمة المرور...'
                            : 'تحديث كلمة المرور'}
                        </span>
                      </button>
                    </div>
                  </form>

                  {/* 4. Notification Management */}
                  <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/40 p-5 sm:p-6 flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2.5 border-b border-[#D97757]/25 pb-3">
                        <Bell className="w-5 h-5 text-[#D97757]" />
                        <div>
                          <h2 className="text-base font-display font-bold text-[#1F1F1C]">
                            3. إدارة الإشعارات البريدية
                          </h2>
                          <p className="text-xs text-[#1F1F1C]/70">
                            تحكم في التنبيهات المرسلة إلى بريدك ({userEmail})
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F5F1E8] border border-[#D97757]/35 cursor-pointer">
                          <div>
                            <div className="text-xs sm:text-sm font-display font-bold text-[#1F1F1C]">
                              إشعارات تحديث تذاكر البحث والتحقيق النسبي
                            </div>
                            <div className="text-[11px] text-[#1F1F1C]/65 mt-0.5">
                              استلام بريد فوري عند إثراء عمود نسبك أو إضافة مصادر جديدة من الباحثين
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={emailNotificationsTicket}
                            onChange={(e) => {
                              const nextVal = e.target.checked;
                              setEmailNotificationsTicket(nextVal);
                              if (resolvedCustomerUid) {
                                updateUserProfile(resolvedCustomerUid, {
                                  emailNotificationsTicket: nextVal,
                                  emailNotificationsEnabled:
                                    nextVal || emailNotificationsTree,
                                }).catch(() => {});
                              }
                            }}
                            className="w-4 h-4 accent-[#D97757] rounded cursor-pointer shrink-0"
                          />
                        </label>

                        <label className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F5F1E8] border border-[#D97757]/35 cursor-pointer">
                          <div>
                            <div className="text-xs sm:text-sm font-display font-bold text-[#1F1F1C]">
                              إشعارات إضافات وتحديثات شجرة العائلة (شجرتي)
                            </div>
                            <div className="text-[11px] text-[#1F1F1C]/65 mt-0.5">
                              تنبيهات دورية عند توثيق أفراد جدد أو وثائق في خزانة الأسرة
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={emailNotificationsTree}
                            onChange={(e) => {
                              const nextVal = e.target.checked;
                              setEmailNotificationsTree(nextVal);
                              if (resolvedCustomerUid) {
                                updateUserProfile(resolvedCustomerUid, {
                                  emailNotificationsTree: nextVal,
                                  emailNotificationsEnabled:
                                    emailNotificationsTicket || nextVal,
                                }).catch(() => {});
                              }
                            }}
                            className="w-4 h-4 accent-[#D97757] rounded cursor-pointer shrink-0"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#D97757]/20 text-xs text-[#D97757] font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-[#D97757]" />
                        <span>تُرسل جميع رموز التوثيق والمراسلات والإشعارات باسم «منصة جذوري» عبر info@Juthori.com</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5. Community Blocked Users Governance (إدارة المستخدمين المحظورين في مجتمعي) */}
                <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/40 p-5 sm:p-6 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[#1F1F1C] font-display font-extrabold text-sm sm:text-base">
                      <ShieldCheck className="w-5 h-5 text-[#D97757]" />
                      <span>4. إدارة المستخدمين المحظورين في «مجتمعي»</span>
                    </div>
                    <span className="text-xs font-semibold text-[#D97757] bg-[#F5F1E8] border border-[#D97757]/35 px-2.5 py-1 rounded-lg">
                      المحظورون حالياً: {blockedUserIds.length}
                    </span>
                  </div>
                  <p className="text-xs text-[#1F1F1C]/75 leading-relaxed">
                    يتم إخفاء منشورات وتعليقات المستخدمين المحظورين فوراً من واجهة «مجتمعي» الخاصة بك، ويمكنك فك الحظر عن أي حساب في أي وقت.
                  </p>

                  {blockedUserIds.length === 0 ? (
                    <div className="rounded-xl bg-[#F5F1E8] border border-[#D97757]/30 px-4 py-3 text-xs text-[#1F1F1C]/70">
                      لا يوجد أي مستخدم محظور في قائمة الحظر الخاصة بحسابك حالياً.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {blockedUserIds.map((bUid) => {
                        const meta = blockedUsersMeta.find(
                          (item) => item.userId === bUid
                        );
                        return (
                          <div
                            key={bUid}
                            className="rounded-xl bg-[#F5F1E8] border border-[#D97757]/35 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3"
                          >
                            <div>
                              <div className="text-xs sm:text-sm font-display font-bold text-[#1F1F1C]">
                                {meta?.name || 'عضو في مجتمعي'}
                              </div>
                              <div className="text-[11px] text-[#1F1F1C]/60 font-mono" dir="ltr">
                                {bUid}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUnblockCommunityUser(bUid)}
                              className="px-3.5 py-1.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold cursor-pointer transition-colors"
                            >
                              فك الحظر
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 6. Danger Zone (منطقة الخطر - طلب حذف الحساب نهائياً) */}
                <div className="rounded-2xl bg-[#F5F1E8]/70 border-2 border-[#D8C7B2] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[#1F1F1C] font-display font-extrabold text-base">
                      <ShieldAlert className="w-5 h-5 text-[#D97757]" />
                      <span>5. منطقة الخطر (Danger Zone)</span>
                    </div>
                    <p className="text-xs text-[#1F1F1C]/80 leading-relaxed max-w-2xl">
                      حذف الحساب نهائياً يؤدي إلى إزالة ملفك الشخصي وبيانات جلستك من قاعدة بيانات Firebase وإنهاء الجلسة الحالية فوراً.
                    </p>
                  </div>

                  {!showDeleteAccountConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowDeleteAccountConfirm(true)}
                      className="px-4 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>طلب حذف الحساب نهائياً</span>
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={isDeletingAccount}
                        onClick={handleConfirmDeleteAccount}
                        className="px-4 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-extrabold cursor-pointer disabled:opacity-60"
                      >
                        {isDeletingAccount
                          ? 'جاري حذف الحساب...'
                          : 'تأكيد الحذف النهائي من Firebase'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteAccountConfirm(false)}
                        className="px-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs font-bold text-[#1F1F1C] cursor-pointer"
                      >
                        تراجع
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeUtilityDrawer === 'cart' && (
              <WalletView
                result={result}
                userId={resolvedCustomerUid}
                userEmail={userEmail}
                isVip={caps.isVip}
                currentPlanId={caps.subscriptionPlan}
                billingCycle={activeBillingCycle}
                ambassadorFreeMonths={ambassadorFreeMonths}
                ambassadorCapacityBonus={ambassadorCapacityBonus}
                onUpgradeSuccess={handleUpgradeAnnualVip}
                onSelectPlanUpgrade={handleUpgradeToPlan}
                onNavigateToAmbassador={() => {
                  setActiveUtilityDrawer(null);
                  setActiveTab(DashboardTab.MyCommunity);
                }}
                onLogActivity={appendActivity}
                emailVerified={isEmailVerified}
                showEmailReminderBanner={
                  !isEmailVerified && !dismissedEmailBannerInWallet
                }
                onDismissEmailReminderBanner={() =>
                  setDismissedEmailBannerInWallet(true)
                }
                onOpenEmailVerification={() =>
                  setActiveUtilityDrawer('settings')
                }
              />
            )}

            {activeUtilityDrawer === 'notifications' && (
              <div className="space-y-4">
                {pendingCircleJoinRequests.length > 0 && (
                  <div className="rounded-2xl bg-[#FAF7F2] border border-[#D97757]/45 p-4">
                    <SocialJoinRequestsList
                      requests={pendingCircleJoinRequests}
                      ownerName={`${result.clientName || ''} ${result.familyName || ''}`.trim()}
                      variant="compact"
                      title="طلبات الانضمام لدائرة العائلة"
                      onApproved={(req) => {
                        appendActivity(
                          'اعتماد طلب انضمام لدائرة العائلة',
                          `تمت إضافة ${req.requesterName} (${req.kinshipNote}) إلى دائرة عائلة ${result.familyName}`
                        );
                      }}
                    />
                  </div>
                )}

                <div className="space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-xl bg-[#F5F1E8] border border-[#D97757]/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-display font-bold text-[#1F1F1C]">
                        {n.title}
                      </div>
                      <div className="text-xs text-[#1F1F1C]/75 mt-1">{n.body}</div>
                    </div>
                    {n.actionType === 'unlock_5' && !caps.isRootUnlocked && (
                      <button
                        type="button"
                        onClick={handleUnlockRoot5Usd}
                        className="px-4 py-2 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-display font-bold whitespace-nowrap cursor-pointer"
                      >
                        فتح الجذر ($5)
                      </button>
                    )}
                    {n.actionType === 'upgrade_vip' && !caps.isVip && (
                      <button
                        type="button"
                        onClick={handleUpgradeAnnualVip}
                        className="px-4 py-2 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold whitespace-nowrap cursor-pointer"
                      >
                        ترقية لبريميوم
                      </button>
                    )}
                    {(n.id.startsWith('notif_') ||
                      n.title.includes('مرصد البحوث') ||
                      n.title.includes('تذكرة') ||
                      n.title.includes('الباحث')) &&
                      caps.isVip && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveUtilityDrawer(null);
                            setActiveTab(DashboardTab.ResearchTickets);
                          }}
                          className="px-4 py-2 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-display font-bold whitespace-nowrap cursor-pointer"
                        >
                          متابعة والرد على الباحث
                        </button>
                      )}
                  </div>
                ))}
                </div>
              </div>
            )}

            {activeUtilityDrawer === 'activity' && (
              <div className="space-y-6">
                {/* Official Legal Audit Trail & Electronic Signatures Card */}
                <div className="rounded-2xl bg-[#F5F1E8] border-2 border-[#D97757]/45 p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D97757]/30 pb-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
                        <FileSignature className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-display font-extrabold text-[#1F1F1C]">
                          سجل التدقيق القانوني والموافقات الإلكترونية (Audit Trail)
                        </h3>
                        <p className="text-xs text-[#1F1F1C]/70">
                          توثيق رسمي مرتبط بحسابك في قواعد بيانات Firebase لعقود أمين السجل وشروط الاستخدام وسياسة الخصوصية
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCharterModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileSignature className="w-3.5 h-3.5" />
                      <span>
                        {accountType === AccountLegalType.RecordKeeper
                          ? 'استعراض العقد الموقّع وشهادة الإكمال'
                          : 'قراءة وتوقيع عقد أمين السجل'}
                      </span>
                    </button>
                  </div>

                  {userAuditTrail.length === 0 ? (
                    <div className="rounded-xl bg-[#F5F1E8] border border-[#D97757]/35 p-4 text-xs text-[#1F1F1C]/75 flex items-center justify-between gap-3">
                      <span>
                        لم يتم تسجيل شهادات توقيع إلكتروني إضافية بعد. يمكنك استعراض وتوقيع عقد أمين السجل لتفعيل بناء الشجرة.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userAuditTrail.map((audit) => (
                        <div
                          key={audit.id}
                          className="rounded-xl bg-[#F5F1E8] border border-[#D97757]/40 p-4 space-y-2.5 shadow-2xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                  audit.eventType === 'RECORD_KEEPER_CONTRACT_SIGNATURE'
                                    ? 'bg-[#F5F1E8] border-[#D8C7B2] text-[#1F1F1C]'
                                    : 'bg-[#F5F1E8] border-[#D97757]/50 text-[#D97757]'
                                }`}
                              >
                                {audit.eventType === 'RECORD_KEEPER_CONTRACT_SIGNATURE'
                                  ? 'عقد أمين السجل الموثّق ✓'
                                  : 'موافقة شروط الاستخدام وسياسة الخصوصية ✓'}
                              </span>
                              <span className="text-xs sm:text-sm font-display font-extrabold text-[#1F1F1C]">
                                {audit.documentTitle}
                              </span>
                            </div>
                            <span
                              dir="ltr"
                              className="px-2.5 py-1 rounded-lg bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] font-mono text-[11px] font-bold"
                            >
                              {audit.certificateCode}
                            </span>
                          </div>

                          <p className="text-xs text-[#1F1F1C]/80 leading-relaxed bg-[#F5F1E8]/70 rounded-lg p-2.5 border border-[#D97757]/25">
                            {audit.consentStatement}
                          </p>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#1F1F1C]/70 pt-1">
                            <span>
                              الإصدار:{' '}
                              <strong className="font-mono text-[#1F1F1C]">
                                {audit.documentVersion}
                              </strong>{' '}
                              · البريد:{' '}
                              <strong className="font-mono text-[#1F1F1C]">
                                {audit.userEmail}
                              </strong>
                            </span>
                            <span>
                              عنوان IP:{' '}
                              <strong className="font-mono text-[#1F1F1C]" dir="ltr">
                                {audit.ipAddress}
                              </strong>{' '}
                              ({audit.ipCountry}) · التاريخ: {audit.signedAtFormatted}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Operational Activity Log */}
                <div className="space-y-2.5">
                  <div className="text-xs font-display font-bold text-[#D97757]">
                    السجل الزمني للعمليات في الحساب:
                  </div>
                  {activityLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl bg-[#F5F1E8] border border-[#D97757]/35 px-4 py-3 flex items-center justify-between gap-3 text-xs sm:text-sm"
                    >
                      <div>
                        <strong className="text-[#1F1F1C]">{entry.action}:</strong>{' '}
                        <span className="text-[#1F1F1C]/80">{entry.detail}</span>
                      </div>
                      <span className="text-[#1F1F1C]/60 whitespace-nowrap text-xs">
                        {entry.timestamp}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeUtilityDrawer === 'help' && (
              <SupportAndHelpCenterView
                compactMode
                defaultUserName={[
                  result.clientName,
                  result.fatherName,
                  result.familyName,
                ]
                  .filter((s) => s && s !== '—')
                  .join(' ')}
                defaultUserEmail={userEmail}
                hasDirectCustomerSupport={caps.hasDirectCustomerSupport}
                onRequireDirectSupportUpgrade={() =>
                  requestPremiumAction({
                    feature: 'customer_support',
                    requiredTier: 'basic',
                  })
                }
              />
            )}
          </div>
        ) : activeTab === DashboardTab.Lineage ? (
          <LineageSpineColumn
            stateMode={stateMode}
            accountType={accountType}
            result={activeResult}
            bridgedAncestors={bridgedAncestors}
            onAddBridgedAncestor={(name) => {
              setBridgedAncestors((prev) => [...prev, name]);
              appendActivity(
                'إضافة جد وسيط (+ الخامس)',
                `إضافة «${name}» بين العائلة والجذر`
              );
            }}
            onUnlockRoot5Usd={handleUnlockRoot5Usd}
            onUpgradeAnnualVip={handleUpgradeAnnualVip}
            onRequirePremiumAction={requestPremiumAction}
            unlockedCapsules={unlockedCapsules}
            onRequestUnlockCapsule={handleRequestUnlockCapsule}
            onRequestUnlockAllCapsulesBundle={handleRequestUnlockAllCapsulesBundle}
            walletBalance={walletBalance}
            onUpdateImmediateParents={onUpdateImmediateParents}
            userAvatarUrl={avatarUrl || undefined}
            onSelectVerificationPath={handleSelectVerificationPath}
            onEscalateVerificationToTicket={handleEscalateVerificationToTicket}
            unlockedAddonSourceIds={unlockedAddonSourceIds}
            onUnlockVerifiedAddonSource={handleUnlockVerifiedAddonSource}
            onOpenMyTreeTab={() => {
              const treeTab = DASHBOARD_TABS.find(
                (t) => t.id === DashboardTab.MyTree
              );
              if (treeTab) handleTabClick(treeTab);
            }}
            onOpenResearchTicketsTab={() => {
              setActiveUtilityDrawer(null);
              setActiveTab(DashboardTab.MyExplorer);
            }}
            onResyncLineage={onResyncLineageFromEngine}
            isResyncingLineage={isResyncingLineage}
            userId={resolvedCustomerUid}
            userEmail={userEmail}
            onOpenVaultForPerson={(personId) => {
              setVaultPersonFilterId(personId);
              setActiveUtilityDrawer(null);
              setActiveTab(DashboardTab.MyVault);
            }}
            onSignCharterAndEnableTree={handleSignCharterAndOpenTree}
            onLogActivity={appendActivity}
            freeLeadRadarSignal={freeLeadRadarSignal}
            lineageResearchStatus={lineageResearchStatus}
            lineageResearchStatusNote={lineageResearchStatusNote}
          />
        ) : activeTab === DashboardTab.MyExplorer ? (
          <KashafiHubView
            result={activeResult}
            accountType={accountType}
            caps={caps}
            walletBalance={walletBalance}
            userId={resolvedCustomerUid}
            userEmail={userEmail}
            userPhone={editPhone}
            onNavigateTab={(t) => {
              if (t === DashboardTab.ResearchTickets) {
                setActiveUtilityDrawer(null);
                setActiveTab(DashboardTab.MyExplorer);
                return;
              }
              const found = DASHBOARD_TABS.find((x) => x.id === t);
              if (found) handleTabClick(found);
            }}
            onOpenWalletDrawer={() => setActiveUtilityDrawer('cart')}
            onUpgradeAnnualVip={handleUpgradeAnnualVip}
            onRequirePremiumAction={requestPremiumAction}
            onWalletBalanceUpdated={(nextBal) => setWalletBalance(nextBal)}
            onLogActivity={appendActivity}
            onAdoptResolvedLineage={(enriched) => {
              setVerifiedResultOverride(enriched);
              onUpdateLineageResult?.(enriched);
              setHasResearcherReplyWaiting(false);
            }}
            onTicketsStatusChange={({
              hasAnyTicket,
              hasResearcherReplyWaiting: waiting,
            }) => {
              setHasCustomerResearchTicket(hasAnyTicket);
              setHasResearcherReplyWaiting(waiting);
            }}
            onKashafiUnreadCountChange={(count) =>
              setKashafiUnreadItemsCount(count)
            }
          />
        ) : activeTab === DashboardTab.ResearchTickets ? (
          <ResearchTicketsView
            result={activeResult}
            accountType={accountType}
            userEmail={userEmail}
            userId={resolvedCustomerUid}
            userPhone={editPhone}
            isVip={caps.isVip}
            onRequestUpgradeVip={handleUpgradeAnnualVip}
            onLogActivity={appendActivity}
            onAdoptResolvedLineage={(enriched) => {
              setVerifiedResultOverride(enriched);
              onUpdateLineageResult?.(enriched);
              setHasResearcherReplyWaiting(false);
            }}
          />
        ) : (
          <div className="w-full space-y-4">
            {activeTab === DashboardTab.MyTree && charterSignedBanner && (
              <div className="rounded-2xl bg-[#F5F1E8] border-2 border-[#D8C7B2] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#D97757] text-[#F5F1E8] flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-display font-extrabold text-[#1F1F1C]">
                      تم اعتماد توقيعك الإلكتروني وتفعيل صلاحية «رب أسرة / أمين السجل» بنجاح ✓
                    </div>
                    <div className="text-xs text-[#1F1F1C]/85 mt-0.5">
                      شهادة الإكمال في سجل التدقيق (Audit Trail):{' '}
                      <strong className="font-mono" dir="ltr">
                        {charterSignedBanner.certificateCode}
                      </strong>{' '}
                      · يمكنك الآن بناء وإدارة شجرة عائلة ({activeResult.familyName}) بحرية كاملة.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowCharterModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] text-xs font-bold cursor-pointer"
                  >
                    عرض العقد الموقّع
                  </button>
                  <button
                    type="button"
                    onClick={() => setCharterSignedBanner(null)}
                    aria-label="إخفاء التنبيه"
                    className="p-1.5 rounded-lg hover:bg-[#E8DED2]/60 text-[#1F1F1C] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <PremiumTabViews
              activeTab={activeTab}
              result={activeResult}
              accountType={accountType}
              caps={caps}
              onNavigateTab={(t) => {
                if (t === DashboardTab.ResearchTickets) {
                  setActiveUtilityDrawer(null);
                  setActiveTab(DashboardTab.ResearchTickets);
                  return;
                }
                const found = DASHBOARD_TABS.find((x) => x.id === t);
                if (found) handleTabClick(found);
              }}
              onUnlockRoot5Usd={handleUnlockRoot5Usd}
              onUpgradeAnnualVip={handleUpgradeAnnualVip}
              onSignCharterAndEnableTree={handleSignCharterAndOpenTree}
              onRequirePremiumAction={requestPremiumAction}
              onLogActivity={appendActivity}
              onSyncImmediateParents={onUpdateImmediateParents}
              unlockedCapsules={unlockedCapsules}
              unlockedAddonSourceIds={unlockedAddonSourceIds}
              onRequestUnlockCapsule={handleRequestUnlockCapsule}
              onRequestUnlockAllCapsulesBundle={handleRequestUnlockAllCapsulesBundle}
              walletBalance={walletBalance}
              extraTreeCapacity={effectiveTotalExtraTreeCapacity}
              extraVaultCapacity={ambassadorCapacityBonus}
              ambassadorFreeMonths={ambassadorFreeMonths}
              ambassadorCapacityBonus={ambassadorCapacityBonus}
              freeLeadRadarSignal={freeLeadRadarSignal}
              lineageResearchStatus={lineageResearchStatus}
              lineageResearchStatusNote={lineageResearchStatusNote}
              onPurchaseExtraTreeCapacity={async (
                extraSlots: number,
                priceUsd: number
              ) => {
                const fullName = [
                  activeResult.clientName,
                  activeResult.fatherName,
                  activeResult.grandfatherName,
                  activeResult.familyName,
                ]
                  .filter((s) => s && s !== '—')
                  .join(' ');
                const atomicRes = await executeAtomicWalletOperation({
                  userId: resolvedCustomerUid,
                  userEmail,
                  userFullName: fullName,
                  operationType: 'UNLOCK_CAPSULE',
                  amountUsd: priceUsd,
                  paymentMethod: 'wallet',
                  descriptionAr: `إضافة سعة إضافية لشجرة العائلة (+${extraSlots} فرداً)`,
                  skipFeatureIdempotency: true,
                });
                if (atomicRes.status === 'INSUFFICIENT_FUNDS') {
                  setWalletBalance(atomicRes.balanceBefore);
                  return {
                    ok: false,
                    shortfallUsd:
                      atomicRes.shortfallUsd ??
                      Math.max(0, Number((priceUsd - atomicRes.balanceBefore).toFixed(2))),
                    balanceAfter: atomicRes.balanceBefore,
                  };
                }
                const nextExtra = extraTreeCapacity + extraSlots;
                setWalletBalance(atomicRes.balanceAfter);
                setExtraTreeCapacity(nextExtra);
                if (typeof window !== 'undefined') {
                  try {
                    window.localStorage.setItem(
                      `juthori_extra_tree_capacity_${userEmail || 'guest'}`,
                      String(nextExtra)
                    );
                  } catch {
                    // ignore storage errors
                  }
                }
                updateUserProfile(resolvedCustomerUid, {
                  extraTreeCapacity: nextExtra,
                }).catch(() => {});
                appendActivity(
                  `إضافة سعة شجرة (+${extraSlots} فرداً · $${priceUsd})`,
                  `تم رفع السعة الإجمالية للشجرة إلى ${
                    (caps.maxTreeMembers || 100) + nextExtra + ambassadorCapacityBonus
                  } فرداً`
                );
                return {
                  ok: true,
                  balanceAfter: atomicRes.balanceAfter,
                };
              }}
              userAvatarUrl={avatarUrl || undefined}
              userId={resolvedCustomerUid}
              userEmail={userEmail}
              userPhone={editPhone}
              dashboardNotifications={notifications}
              onOpenWalletDrawer={() => setActiveUtilityDrawer('cart')}
              onOpenNotificationsDrawer={() => {
                setActiveUtilityDrawer('notifications');
                setNotifications((prev) =>
                  prev.map((n) => ({ ...n, unread: false }))
                );
              }}
              onOpenFullResearchTickets={() => {
                setActiveUtilityDrawer(null);
                setActiveTab(DashboardTab.ResearchTickets);
              }}
              onAdoptResolvedLineage={(enriched) => {
                setVerifiedResultOverride(enriched);
                onUpdateLineageResult?.(enriched);
                setHasResearcherReplyWaiting(false);
              }}
              onTicketsStatusChange={({
                hasAnyTicket,
                hasResearcherReplyWaiting: waiting,
              }) => {
                setHasCustomerResearchTicket(hasAnyTicket);
                setHasResearcherReplyWaiting(waiting);
              }}
              initialSiteSettings={siteSettings}
              onSaveSiteSettings={(nextSettings) => setSiteSettings(nextSettings)}
              initialCommunityPosts={communityPosts}
              onSaveCommunityPosts={(nextPosts) => setCommunityPosts(nextPosts)}
              emailVerified={isEmailVerified}
              onOpenEmailVerification={() => setActiveUtilityDrawer('settings')}
              initialVaultPersonFilterId={vaultPersonFilterId}
              onConsumeVaultPersonFilterId={() => setVaultPersonFilterId(null)}
              onOpenVaultForPerson={(personId) => {
                setVaultPersonFilterId(personId);
                setActiveUtilityDrawer(null);
                setActiveTab(DashboardTab.MyVault);
              }}
              blockedUserIds={blockedUserIds}
              onBlockCommunityUser={handleBlockCommunityUser}
            />
          </div>
        )}
      </main>

      {/* Platform Editorial Footer matching LandingPage */}
      <footer className="border-t border-[#D97757]/30 bg-[#E8DED2]/70 py-12 mt-12">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center space-y-3.5">
          <div className="mb-1">
            <JuthoriLogo
              size="sm"
              onClick={onBackToLanding}
              confirmHomeNavigation
              confirmAlign="center"
            />
          </div>
          <p className="text-base font-display font-medium text-[#1F1F1C]/85 max-w-xl">
            ما لا يُوثق اليوم… قد يصبح مجرد رواية غامضة غدًا.
          </p>
          <p className="text-sm text-[#1F1F1C]/75 max-w-xl">
            تعمل المنصة من خلال شركة جينيا لاب - الولايات المتحدة الأمريكية.
          </p>
          <div className="space-y-1 pt-2">
            <p className="text-xs text-[#1F1F1C]/70">
              منصة الأنساب والإرث العائلي العربي — juthori.com
            </p>
            <p className="text-xs text-[#1F1F1C]/70">
              جميع الحقوق محفوظة. جذوري © 2026
            </p>
          </div>
        </div>
      </footer>

      {/* MODAL 1: Locked Premium Tab Prompt */}
      {lockedTabPromptName && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1F1C]/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="locked-tab-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#F5F1E8] border border-[#D97757]/50 p-6 sm:p-7 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center">
                <Lock className="w-5 h-5" aria-hidden="true" />
              </div>
              <button
                type="button"
                onClick={() => setLockedTabPromptName(null)}
                aria-label="إغلاق"
                className="w-9 h-9 rounded-lg hover:bg-[#E8DED2] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3
              id="locked-tab-modal-title"
              className="text-lg font-display font-bold text-[#1F1F1C]"
            >
              ميزة «{lockedTabPromptName}» متاحة عبر باقات الترقية
            </h3>
            <p className="text-sm text-[#1F1F1C]/80 leading-relaxed">
              رقِّ اشتراكك إلى الباقة الأساسية أو باقة بريميوم للاستفادة الكاملة من عمود النسب، كشّافي، موقع العائلة، والتوسّع السحابي الموثّق.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  const featureTitle = lockedTabPromptName || 'مزايا جذوري المتقدمة';
                  setLockedTabPromptName(null);
                  setActiveUpgradePrompt({
                    feature: 'site_publish',
                    title: featureTitle,
                    description:
                      'اختر الباقة الأنسب لاحتياجك (الأساسية أو بريميوم) بفوترة شهرية أو سنوية بتوفير 17%.',
                  });
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-sm font-display font-bold cursor-pointer"
              >
                استعراض باقات الترقية (ابتداءً من ${SUBSCRIPTION_PLANS.basic.monthlyPriceUsd}/شهر)
              </button>
              <button
                type="button"
                onClick={() => setLockedTabPromptName(null)}
                className="py-2.5 px-4 rounded-xl bg-[#E8DED2] text-[#1F1F1C] text-sm font-semibold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Dedicated Full 29-Article Record Keeper Contract Reader & Electronic Signature Module */}
      <RecordKeeperContractModal
        isOpen={showCharterModal}
        onClose={() => setShowCharterModal(false)}
        onProceedToMyTree={() => {
          setShowCharterModal(false);
          setActiveUtilityDrawer(null);
          const pendingPrompt = pendingUpgradePromptRef.current;
          if (pendingPrompt) {
            const continueFn = pendingPrompt.onAuthorizedContinue;
            pendingUpgradePromptRef.current = null;
            setActiveUpgradePrompt(null);
            if (continueFn) {
              window.setTimeout(() => continueFn(), 120);
            }
            return;
          }
          setActiveTab(DashboardTab.MyTree);
        }}
        onConfirmElectronicSignature={handleConfirmRecordKeeperContractSignature}
        clientFullName={
          [
            result.clientName,
            result.fatherName,
            result.grandfatherName,
            result.familyName,
          ]
            .filter((s) => s && s !== '—')
            .join(' ') || `${result.clientName} ${result.familyName}`.trim()
        }
        familyName={result.familyName}
        userEmail={userEmail}
        userPhone={editPhone}
        originCountry={result.originCountry}
        originRegion={result.originRegion || editOriginRegion}
        orderReference={`ORD-${(
          userId ||
          auth.currentUser?.uid ||
          userEmail ||
          'JTH2026'
        )
          .slice(-6)
          .toUpperCase()}`}
        ipAddress={silentGeo?.ip || '127.0.0.1'}
        ipCountry={silentGeo?.ip_country || result.originCountry || 'السعودية'}
        ipCity={silentGeo?.ip_city || result.originRegion || ''}
        isAlreadySigned={accountType === AccountLegalType.RecordKeeper}
        existingAuditEntry={
          userAuditTrail.find(
            (a) => a.eventType === 'RECORD_KEEPER_CONTRACT_SIGNATURE'
          ) || null
        }
      />

      {/* MODAL 3: Direct Subscription Checkout Modal */}
      <CheckoutModal
        order={activeCheckoutOrder}
        walletBalance={walletBalance}
        onClose={() => setActiveCheckoutOrder(null)}
        onExecutePayment={handleExecuteCheckoutPayment}
        onConfirmSuccess={handleConfirmCheckoutSuccess}
      />
      {/* MODAL 4: Unified 3-Tier Subscription Upgrade + Registrar Charter Signature Modal */}
      <UpgradeToPremiumModal
        isOpen={Boolean(activeUpgradePrompt)}
        request={activeUpgradePrompt}
        familyName={activeResult.familyName}
        isVip={caps.isVip}
        currentPlanId={caps.subscriptionPlan}
        isCharterSigned={accountType === AccountLegalType.RecordKeeper}
        onClose={() => {
          setActiveUpgradePrompt(null);
          pendingUpgradePromptRef.current = null;
        }}
        onStartVipCheckout={() => {
          setActiveUpgradePrompt(null);
          handleUpgradeAnnualVip();
        }}
        onSelectPlanCheckout={(planId, billingCycle) => {
          // Close modal temporarily while CheckoutModal runs, keeping pendingUpgradePromptRef intact
          setActiveUpgradePrompt(null);
          handleUpgradeToPlan(planId, billingCycle);
        }}
        onConfirmCharterSignature={handleConfirmRecordKeeperContractSignature}
        onOpenFullContractModal={() => {
          setActiveUpgradePrompt(null);
          setShowCharterModal(true);
        }}
      />
    </div>
  );
};
