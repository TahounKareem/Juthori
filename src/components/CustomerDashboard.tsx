import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  AlertCircle,
  Archive,
  Bell,
  Camera,
  CheckCircle2,
  ChevronDown,
  Compass,
  CreditCard,
  Crown,
  FileSignature,
  GitCommitVertical,
  GitFork,
  Globe,
  HelpCircle,
  Home,
  KeyRound,
  Landmark,
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
  Users,
  X,
  ArrowRight,
} from 'lucide-react';
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
  AccountLegalType,
  ActivityLogEntry,
  AncestorCapsule,
  CartItem,
  CheckoutOrderRequest,
  DashboardStateMode,
  DashboardTab,
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
  resolveRoyalRoleLabel,
} from './RoyalRoleFamilyBadge';
import { DashboardHeaderWatermark } from './DashboardHeaderWatermark';
import { CheckoutExecutionResult, CheckoutModal } from './CheckoutModal';
import { SupportAndHelpCenterView } from './SupportAndHelpCenterView';
import { ResearchTicketsView } from './ResearchTicketsView';

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
  onResyncLineageFromEngine?: () => Promise<void>;
  isResyncingLineage?: boolean;
}

const DASHBOARD_TABS: Array<{
  id: DashboardTab;
  label: string;
  premium: boolean;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}> = [
  { id: DashboardTab.Home, label: 'الرئيسية', premium: false, icon: Home },
  {
    id: DashboardTab.Lineage,
    label: 'عمود نسبي',
    premium: false,
    icon: GitCommitVertical,
  },
  { id: DashboardTab.MyTree, label: 'شجرتي', premium: false, icon: GitFork },
  { id: DashboardTab.MyVault, label: 'خزانتي', premium: false, icon: Archive },
  { id: DashboardTab.MySite, label: 'موقعي', premium: false, icon: Landmark },
  { id: DashboardTab.MyCommunity, label: 'مجتمعي', premium: false, icon: Users },
  { id: DashboardTab.MyExplorer, label: 'كشّافي', premium: false, icon: Compass },
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
    if (!initialAutoOpenVipUpgrade) return;
    setActiveCheckoutOrder({
      id: 'ord-vip-60',
      type: 'upgrade_vip_60',
      title: 'الاشتراك السنوي الشامل — عضوية بريميوم (VIP)',
      subtitle:
        'يفتح المحطات الرئيسية الموثقة حتى آدم عليه السلام + رفع سعة شجرتي لـ 250 فرداً وخزانتي لـ 100 وثيقة + نشر موقعي + $25 رصيد هدية',
      amountUsd: 60,
      allowWalletPayment: true,
      bonusWalletUsd: 25,
    });
    onClearAutoOpenVipUpgrade?.();
  }, [initialAutoOpenVipUpgrade, onClearAutoOpenVipUpgrade]);
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
  const [isEmailVerified, setIsEmailVerified] =
    useState<boolean>(isGoogleAuthSession);
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
          if (googleVerified || profile.emailVerified === true) {
            setIsEmailVerified(true);
            if (profile.emailVerifiedAt) {
              setEmailVerifiedAt(profile.emailVerifiedAt);
            }
          } else {
            setIsEmailVerified(false);
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
          const isPaidAnnual =
            profile.subscriptionTier === 'premium_annual' ||
            (typeof profile.paidRevenueUsd === 'number' &&
              profile.paidRevenueUsd >= 55);
          const isPaidBasicRoot =
            profile.subscriptionTier === 'basic_verified' ||
            profile.isRootUnlocked === true ||
            (typeof profile.paidRevenueUsd === 'number' &&
              profile.paidRevenueUsd >= 5);

          if (isPaidAnnual && stateMode !== DashboardStateMode.AnnualVip) {
            onChangeStateMode(DashboardStateMode.AnnualVip);
          } else if (
            isPaidBasicRoot &&
            stateMode !== DashboardStateMode.AnnualVip &&
            stateMode !== DashboardStateMode.State1Paid5Basic
          ) {
            onChangeStateMode(DashboardStateMode.State1Paid5Basic);
          }
          if (
            (profile.accountType === 'record_keeper' ||
              profile.recordKeeperCharterSigned) &&
            accountType !== AccountLegalType.RecordKeeper
          ) {
            onUpgradeAccountToRecordKeeper();
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
              setVerifiedResultOverride((curr) => curr || hydratedFromProfile);
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

  // Opens 3-Step Realistic Checkout Modal for $60 Annual Premium VIP
  const handleUpgradeAnnualVip = () => {
    setLockedTabPromptName(null);
    setActiveCheckoutOrder({
      id: 'ord-vip-60',
      type: 'upgrade_vip_60',
      title: 'الاشتراك السنوي الشامل — عضوية بريميوم (VIP)',
      subtitle:
        'يفتح المحطات الرئيسية الموثقة حتى آدم عليه السلام + رفع سعة شجرتي لـ 250 فرداً وخزانتي لـ 100 وثيقة + نشر موقعي + $25 رصيد هدية',
      amountUsd: 60,
      allowWalletPayment: true,
      bonusWalletUsd: 25,
    });
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
      order.type === 'unlock_root_5'
        ? 'PURCHASE_ROOT_5USD'
        : order.type === 'upgrade_vip_60'
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
      order.type === 'upgrade_vip_60' ? order.bonusWalletUsd ?? 25 : 0;

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

    if (order.type === 'unlock_root_5') {
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
          paidRevenueUsd: 5,
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
          `سداد ذري ناجح (${txRef}) — فتح الجذر ($5)`,
          `تم الكشف عن الفرع الجامع (${result.rootBranchName}) والقبيلة الأم (${result.rootTribeName})`
        );
      }
    } else if (order.type === 'upgrade_vip_60') {
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
          paidRevenueUsd: 60,
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
          `سداد ذري ناجح (${txRef}) — عضوية بريميوم السنوية ($60)`,
          `فتح المحطات الرئيسية في شجرة آدم والمصادر + رفع السعات وإيداع $${bonusWalletCreditUsd} رصيد هدية`
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
          `سداد ذري ناجح (${txRef}) — ${order.title}`,
          `تم فتح حلقة الأجداد الوسيطين بالخصم من ${paymentMethod === 'wallet' ? 'المحفظة الرقمية' : 'البطاقة البنكية'}`
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
    setActiveTab(DashboardTab.Lineage);
  };

  const handleTabClick = (tab: (typeof DASHBOARD_TABS)[number]) => {
    if (tab.premium && !caps.arePremiumTabsUnlocked) {
      setLockedTabPromptName(tab.label);
      return;
    }

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
        `اعتماد العقد الكامل (${RECORD_KEEPER_CONTRACT_VERSION}) وترقية الصفة القانونية إلى «أمين سجل العائلة ✦» بسعة تصل إلى 250 فرداً`
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

  const availableCartItems: CartItem[] = [];
  if (
    !caps.isRootUnlocked &&
    (stateMode === DashboardStateMode.State2MatchedUnpaid || result.matched) &&
    !result.requiresBlindDisambiguation
  ) {
    availableCartItems.push({
      id: 'root_5_usd',
      title: 'فتح نقطة الربط بالجذر (دفعة لمرة واحدة)',
      subtitle:
        'يكشف عقدتي الجذر الموثق (الفرع الجامع والقبيلة الأم) لعائلتك في السجل التاريخي',
      priceUsd: 5,
      billingLabel: 'لمرة واحدة',
    });
  }
  if (!caps.isVip) {
    availableCartItems.push({
      id: 'vip_annual_60_usd',
      title: 'الاشتراك السنوي الشامل — بريميوم (VIP)',
      subtitle:
        'يفتح المحطات المرمّزة في شجرة آدم والمصادر + التبويبات الخمسة + $25 رصيد محفظة',
      priceUsd: 60,
      billingLabel: 'سنوياً',
    });
  }

  const unreadCount = notifications.filter((n) => n.unread).length;

  // Separate user first name from family name cleanly for the Sculpted Profile Identity Capsule
  const cleanClientFirstName = (result.clientName || '').trim() || 'عضو جذوري';
  const rawClientFamilyName = (result.familyName || '').trim();
  const headerRoleLabel = resolveRoyalRoleLabel({
    accountType,
    hasRegistrarBadge: caps.hasRegistrarBadge,
    isVerifiedOrVip: caps.isVip || caps.isRootUnlocked,
  });

  const renderPrimaryNavigationTabs = (attachMobileRefs: boolean) => (
    <div className="inline-flex items-center gap-0.5 xl:gap-1 p-1 sm:p-1.5 min-[1180px]:p-1 rounded-2xl bg-[#EFE8DA]/82 backdrop-blur-sm border border-[#D4AF37]/25 shadow-[inset_0_1px_2px_rgba(90,65,35,0.07)] shrink-0">
      {DASHBOARD_TABS.map((tab) => {
        const TabIcon = tab.icon;
        const isLocked = tab.premium && !caps.arePremiumTabsUnlocked;
        const isSelected = activeUtilityDrawer === null && activeTab === tab.id;
        const isKashafiTab = tab.id === DashboardTab.MyExplorer;
        const kashafiDynamicCount =
          kashafiUnreadItemsCount + (hasResearcherReplyWaiting ? 1 : 0);

        let buttonClasses =
          'group/tab relative px-3.5 md:px-3.5 min-[1180px]:px-2.5 xl:px-3 py-2 min-[1180px]:py-1.5 rounded-xl text-[12.5px] sm:text-[13px] min-[1180px]:text-[12.5px] xl:text-[13px] font-display font-bold inline-flex items-center justify-center gap-1.5 transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] min-[1180px]:min-h-[38px] snap-center select-none ';

        if (isSelected && isKashafiTab) {
          buttonClasses +=
            'bg-gradient-to-b from-[#2E2722] to-[#1D1916] text-[#F5D896] border border-[#D4AF37]/55 shadow-[0_6px_16px_-6px_rgba(29,25,22,0.58)]';
        } else if (isSelected) {
          buttonClasses +=
            'bg-gradient-to-b from-[#C96C4E] to-[#A85136] text-white shadow-[0_6px_16px_-6px_rgba(168,81,54,0.55)] ring-1 ring-[#F4D698]/35';
        } else if (isLocked) {
          buttonClasses +=
            'text-[#252321]/45 hover:bg-white/55 hover:text-[#252321]/70';
        } else if (isKashafiTab) {
          buttonClasses +=
            'bg-gradient-to-b from-[#FFFDF7] to-[#F7ECDA] text-[#7A4B1B] border border-[#C59B27]/45 hover:border-[#B3861D]/70 hover:bg-[#FFFBF0] hover:shadow-[0_2px_10px_-3px_rgba(197,155,39,0.3)]';
        } else {
          buttonClasses +=
            'text-[#483A2F] hover:bg-white/85 hover:text-[#7C4D2B] hover:shadow-[0_1px_5px_rgba(90,65,35,0.08)]';
        }

        return (
          <React.Fragment key={tab.id}>
            {/* Subtle gilded hairline separating كشّافي within the unified track */}
            {isKashafiTab && (
              <span
                aria-hidden="true"
                className="w-px h-5 bg-[#C59B27]/30 mx-0.5 shrink-0"
              />
            )}

            <button
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
                className={`w-[14px] h-[14px] xl:w-[15px] xl:h-[15px] shrink-0 transition-transform duration-200 ${
                  isSelected && isKashafiTab
                    ? 'text-[#E8C468]'
                    : isSelected
                    ? 'text-[#FBE5B4]'
                    : isKashafiTab
                    ? 'text-[#B38422] group-hover/tab:rotate-12'
                    : 'text-[#8C6A4E]/80 group-hover/tab:text-[#8C5327]'
                }`}
                aria-hidden={true}
              />

              <span>{tab.label}</span>

              {isKashafiTab && (
                <span
                  aria-hidden="true"
                  className={`text-[11px] leading-none ${
                    isSelected ? 'text-[#E8C468]' : 'text-[#C59B27]'
                  }`}
                >
                  ✦
                </span>
              )}

              {isKashafiTab && kashafiDynamicCount > 0 && (
                <span
                  data-testid="kashafi-tab-unread-badge"
                  className={`px-1.5 py-0.5 rounded-full font-mono tabular-nums text-[10px] font-extrabold leading-none ${
                    isSelected
                      ? 'bg-[#D4AF37]/25 text-[#F9E3A6] border border-[#D4AF37]/40'
                      : 'bg-[#8D4925] text-[#FAF4E4]'
                  }`}
                >
                  {kashafiDynamicCount}
                </span>
              )}

              {isLocked && (
                <Lock
                  className="w-3.5 h-3.5 text-[#DC2626]/80 shrink-0"
                  aria-label="ميزة بريميوم مقفلة"
                />
              )}

              {/* Refined Gilded Bottom Glow Indicator on Active Tab */}
              {isSelected && (
                <span
                  aria-hidden="true"
                  className={`absolute bottom-[3px] left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full ${
                    isKashafiTab ? 'bg-[#E8C468]/90' : 'bg-[#FCE3AE]/90'
                  }`}
                />
              )}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-[#F7F2E9] text-[#252321] overflow-x-clip">
      {/* A. PRECISION GRID-ALIGNED RTL LUXURY HEADER SHELL (Exact max-w-7xl parity with page content) */}
      <header className="relative md:sticky md:top-0 z-30 bg-gradient-to-b from-[#FDFBF7]/96 via-[#FAF6EE]/94 to-[#F7F2E8]/92 backdrop-blur-md border-b border-[#D4AF37]/25 shadow-[0_8px_30px_-18px_rgba(88,63,36,0.18)]">
        {/* Subtle Architectural Islamic Arabesque & Lineage Vine SVG Watermark */}
        <DashboardHeaderWatermark />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
          {/* ============================================================== */}
          {/* RESPONSIVE PRECISION HEADER:                                   */}
          {/* • Desktop (>=1180px): Single 76px row — Right Brand + Divider + 7-Tab Nav | Flex Watermark Spacer | Left Cart + Bell + Divider + Profile */}
          {/* • Tablet (768–1179px): Row 1 (Brand right + Account left) + Centered Row 2 (7-Tab Nav)                                                  */}
          {/* • Mobile (<768px): Compact h-14 Bar (Logo right + Mini Alerts & Compact Identity left)                                                   */}
          {/* ============================================================== */}
          <div className="flex flex-wrap min-[1180px]:flex-nowrap items-center justify-between gap-x-2.5 sm:gap-x-3 xl:gap-x-4 h-14 md:h-auto min-[1180px]:h-[76px]">
            {/* 1. RIGHT BRAND ANCHOR (RTL START): Flush with right edge of page content */}
            <div className="order-1 md:py-2.5 min-[1180px]:py-0 flex items-center shrink-0">
              <JuthoriLogo size="sm" onClick={onBackToLanding} />
            </div>

            {/* Golden Vertical Hairline between Brand & Primary 7-Tab Navigation (Desktop >=1180px) */}
            <span
              aria-hidden="true"
              className="hidden min-[1180px]:block min-[1180px]:order-2 h-7 w-px bg-[#D4AF37]/25 shrink-0"
            />

            {/* 2. PRIMARY 7-TAB NAVIGATION (Desktop: Right-anchored right beside Logo | Tablet: Centered Row 2) */}
            <div className="hidden md:flex order-4 min-[1180px]:order-3 w-full min-[1180px]:w-auto border-t border-[#D4AF37]/15 min-[1180px]:border-t-0 py-2.5 min-[1180px]:py-0 items-center justify-center min-[1180px]:justify-start min-w-0 shrink-0">
              <nav
                aria-label="تبويبات لوحة تحكم العميل"
                className="flex items-center justify-center min-[1180px]:justify-start max-w-full"
              >
                {renderPrimaryNavigationTabs(false)}
              </nav>
            </div>

            {/* Flexible Watermark Breathing Zone separating Navigation from Left Account Cluster (Desktop >=1180px) */}
            <div
              aria-hidden="true"
              className="hidden min-[1180px]:block min-[1180px]:order-4 flex-1 min-w-[8px]"
            />

            {/* 3. REFINED LEFT UTILITY & PROFILE CLUSTER (RTL END: Cart → Bell → Hairline → Far-Left Profile Capsule) */}
            <div className="order-2 min-[1180px]:order-5 md:py-2.5 min-[1180px]:py-0 flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* 3a. Cart & Wallet (Quiet when empty, gilded border & badge when populated) */}
              <button
                type="button"
                onClick={() => {
                  setUserDropdownOpen(false);
                  setActiveUtilityDrawer((cur) => (cur === 'cart' ? null : 'cart'));
                }}
                title="الاشتراكات والسلة"
                aria-label="الاشتراكات والسلة"
                className={`group/util relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border transition-all duration-200 cursor-pointer shrink-0 ${
                  activeUtilityDrawer === 'cart'
                    ? 'bg-[#C86B4E]/15 text-[#A85136] border-[#C86B4E]/35 shadow-2xs'
                    : availableCartItems.length > 0
                    ? 'bg-[#FBF4E4]/90 text-[#8C5327] border-[#C59B27]/50 hover:bg-[#F7EAD0] hover:border-[#B88924]/70 shadow-[0_2px_8px_-4px_rgba(197,155,39,0.45)]'
                    : 'bg-transparent border-transparent text-[#8C7B6B]/70 hover:bg-[#C59B27]/10 hover:text-[#7A4B21]'
                }`}
              >
                <ShoppingCart
                  className="w-[17px] h-[17px] transition-transform duration-200 group-hover/util:scale-105"
                  strokeWidth={1.55}
                  aria-hidden="true"
                />
                {availableCartItems.length > 0 && (
                  <span className="absolute -top-0.5 -left-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#8D4925] text-[#FAF4E4] text-[9.5px] font-mono font-bold flex items-center justify-center tabular-nums ring-[1.5px] ring-[#FDFBF7] shadow-2xs">
                    {availableCartItems.length}
                  </span>
                )}
                <span
                  role="tooltip"
                  className="hidden md:block pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-[#252321] text-[#FDFBF7] text-[10.5px] font-display font-semibold whitespace-nowrap shadow-md opacity-0 translate-y-1 group-hover/util:opacity-100 group-hover/util:translate-y-0 transition-all duration-200 z-50"
                >
                  السلة والاشتراكات
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
                    ? 'bg-[#C86B4E]/15 text-[#A85136] border-[#C86B4E]/35 shadow-2xs'
                    : unreadCount > 0
                    ? 'bg-[#FFFDF8]/85 text-[#7A4B21] border-[#D4AF37]/30 hover:bg-[#C59B27]/12 hover:border-[#C59B27]/50 hover:text-[#8C5327]'
                    : 'bg-transparent border-transparent text-[#8C7B6B]/75 hover:bg-[#C59B27]/10 hover:text-[#7A4B21]'
                }`}
              >
                <Bell
                  className="w-[17px] h-[17px] transition-transform duration-200 group-hover/util:scale-105"
                  strokeWidth={1.55}
                  aria-hidden="true"
                />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -left-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#C8372D] text-white text-[9.5px] font-mono font-bold flex items-center justify-center tabular-nums ring-[1.5px] ring-[#FDFBF7] shadow-2xs">
                    {unreadCount}
                  </span>
                )}
                <span
                  role="tooltip"
                  className="hidden md:block pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-[#252321] text-[#FDFBF7] text-[10.5px] font-display font-semibold whitespace-nowrap shadow-md opacity-0 translate-y-1 group-hover/util:opacity-100 group-hover/util:translate-y-0 transition-all duration-200 z-50"
                >
                  الإشعارات
                </span>
              </button>

              {/* 3c. Delicate Vertical Hairline Separating Utility Icons & Profile Capsule */}
              <span
                aria-hidden="true"
                className="hidden sm:block h-6 w-px bg-[#D4AF37]/20 shrink-0"
              />

              {/* 3d. BESPOKE SCULPTED LUXURY PROFILE IDENTITY CAPSULE (Flush Far-Left Anchor) */}
              <div className="relative min-w-0" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen((prev) => !prev)}
                  aria-expanded={userDropdownOpen}
                  aria-haspopup="menu"
                  aria-label="قائمة الحساب الشخصي والأدوات"
                  className={`group relative overflow-hidden flex items-center gap-1.5 md:gap-2 rounded-full pr-1 pl-2 md:pr-1.5 md:pl-2 py-1 border transition-all duration-300 ease-out cursor-pointer text-right max-w-[164px] md:max-w-[340px] xl:max-w-[370px] will-change-transform ${
                    userDropdownOpen
                      ? 'bg-gradient-to-l from-[#FFFDF8] via-[#FAF3E4] to-[#F3E7D2] border-[#C59B27]/65 shadow-[0_8px_22px_-10px_rgba(140,98,57,0.34)] -translate-y-0.5'
                      : 'bg-gradient-to-l from-[#FFFDF9]/95 via-[#FBF6EC]/90 to-[#F4ECDD]/85 border-[#D4AF37]/30 shadow-[0_2px_12px_-5px_rgba(110,80,40,0.16)] hover:-translate-y-0.5 hover:shadow-[0_8px_22px_-10px_rgba(140,98,57,0.28)] hover:border-[#C59B27]/55 active:scale-[0.985]'
                  }`}
                >
                  {/* Subtle GPU-accelerated Specular Sheen Sweep on Hover */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/60 to-transparent -skew-x-12"
                  />

                  {/* Rightmost (RTL Start): Double Gilded Ring Portrait + Royal Premium Crown Medallion */}
                  <span className="relative shrink-0">
                    <span className="block p-[1.5px] md:p-[2px] rounded-full bg-gradient-to-tr from-[#B6863E]/80 via-[#F2D598] to-[#C59B27]/85 transition-shadow duration-300 group-hover:shadow-[0_0_12px_rgba(197,155,39,0.45)]">
                      <span className="block p-[1px] md:p-[1.5px] rounded-full bg-[#FFFDF9]">
                        <span className="w-7 h-7 md:w-8 md:h-8 xl:w-9 xl:h-9 rounded-full bg-[#252321] text-white flex items-center justify-center overflow-hidden">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={`${cleanClientFirstName} ${rawClientFamilyName}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User
                              className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#F3D299]"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                      </span>
                    </span>

                    {caps.isVip && (
                      <span
                        title="عضوية بريميوم"
                        aria-label="عضوية بريميوم"
                        data-testid="header-profile-premium-crown"
                        className="absolute -bottom-0.5 -left-0.5 w-[17px] h-[17px] rounded-full bg-gradient-to-br from-[#F7DE98] via-[#D4AF37] to-[#9E6B24] text-[#23180E] ring-[1.5px] ring-[#FFFDF9] shadow-xs flex items-center justify-center"
                      >
                        <Crown className="w-2.5 h-2.5 stroke-[2.4]" aria-hidden="true" />
                      </span>
                    )}
                  </span>

                  {/* Middle: Clean Single-Row Name + Connected Segmented Role & Family Badge */}
                  <div className="relative z-10 flex items-center gap-1.5 md:gap-2 min-w-0">
                    <span className="text-[12.5px] md:text-[13.5px] font-display font-extrabold text-[#252321] leading-none whitespace-nowrap truncate">
                      {cleanClientFirstName}
                    </span>

                    <RoyalRoleFamilyBadge
                      testId="header-royal-role-family-badge"
                      roleLabel={headerRoleLabel}
                      familyName={result.familyName}
                      variant="header"
                      className="hidden md:inline-flex"
                    />
                  </div>

                  {/* Trailing Left Edge: Animated Sculpted Chevron (▾) */}
                  <span
                    className={`relative z-10 w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 ${
                      userDropdownOpen
                        ? 'bg-[#C59B27]/20 text-[#8C5327]'
                        : 'bg-[#EDE4D3]/75 text-[#6E5643] group-hover:bg-[#E7D8BE]/90 group-hover:text-[#7A4B21]'
                    }`}
                  >
                    <ChevronDown
                      className={`w-3 h-3 md:w-3.5 md:h-3.5 transition-transform duration-300 ease-out ${
                        userDropdownOpen
                          ? 'rotate-180'
                          : 'group-hover:translate-y-0.5'
                      }`}
                      aria-hidden="true"
                    />
                  </span>
                </button>

                {/* UNIFIED PROFILE & TOOLS DROPDOWN MENU (Left-anchored for far-left RTL trigger) */}
                {userDropdownOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 mt-2.5 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-[#FFFDF9]/98 backdrop-blur-md border border-[#D4AF37]/35 shadow-[0_24px_56px_-16px_rgba(37,35,33,0.24)] py-2 z-50 text-right overflow-hidden"
                  >
                    {/* Dropdown Identity Header: Full Name, Royal Role/Family Badge, Premium Crown & Verification */}
                    <div className="px-4 py-3.5 bg-gradient-to-l from-[#FAF5EA] to-[#F5ECDC]/80 border-b border-[#D4AF37]/20 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display font-extrabold text-sm text-[#252321] truncate">
                          {result.clientName}
                          {result.fatherName && result.fatherName !== '—'
                            ? ` بن ${result.fatherName}`
                            : ''}{' '}
                          {result.familyName}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {caps.isVip && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-l from-[#F7E5B7] to-[#FDF5DF] border border-[#D4AF37]/60 text-[#7A4B1B] text-[10px] font-display font-extrabold">
                              <Crown className="w-2.5 h-2.5 text-[#B67A1E]" />
                              <span>بريميوم</span>
                            </span>
                          )}
                          {isEmailVerified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>موثّق ✓</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-[10px] font-bold">
                              <span>غير موثّق</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <RoyalRoleFamilyBadge
                        roleLabel={headerRoleLabel}
                        familyName={result.familyName}
                        variant="header"
                      />

                      <div
                        className="text-xs font-mono text-[#252321]/70 truncate"
                        dir="ltr"
                      >
                        {userEmail}
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
                        className="w-full px-3 py-2 rounded-xl hover:bg-[#F7F2E9] flex items-center gap-3 text-right transition-colors cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#EDE6DA] text-[#8D4925] flex items-center justify-center shrink-0">
                          <User className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-display font-bold text-[#252321]">
                            الملف الشخصي
                          </div>
                          <div className="text-[11px] text-[#252321]/65 truncate">
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
                        className="w-full px-3 py-2 rounded-xl hover:bg-[#F7F2E9] flex items-center gap-3 text-right transition-colors cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#EDE6DA] text-[#D8755B] flex items-center justify-center shrink-0">
                          <CreditCard className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-display font-bold text-[#252321]">
                              الاشتراكات والمحفظة
                            </span>
                            <span className="text-[11px] font-mono tabular-nums font-bold text-[#D8755B]">
                              ${walletBalance}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#252321]/65 truncate">
                            عرض الرصيد الحالي، شحن المحفظة، وترقية الباقة
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
                        className="w-full px-3 py-2 rounded-xl hover:bg-[#F7F2E9] flex items-center gap-3 text-right transition-colors cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#EDE6DA] text-[#8D4925] flex items-center justify-center shrink-0">
                          <FileSignature className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-display font-bold text-[#252321]">
                              ميثاق أمين السجل
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FAF6F0] border border-[#B98A78]/40 text-[#8D4925]">
                              {accountType === AccountLegalType.RecordKeeper
                                ? 'مفعّل ✓'
                                : 'حساب فرد'}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#252321]/65 truncate">
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
                        className="w-full px-3 py-2 rounded-xl hover:bg-[#F7F2E9] flex items-center gap-3 text-right transition-colors cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#EDE6DA] text-[#D8755B] flex items-center justify-center shrink-0">
                          <Scroll className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-display font-bold text-[#252321]">
                              مرصد البحوث ومراسلات النسب
                            </span>
                            {hasResearcherReplyWaiting ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 border border-amber-400 text-amber-950">
                                رد جديد
                              </span>
                            ) : hasCustomerResearchTicket ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FAF6F0] border border-[#B98A78]/40 text-[#8D4925]">
                                قيد المتابعة
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[11px] text-[#252321]/65 truncate">
                            متابعة حالة تحقيق النسب والرد على الباحثين
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Integrated Secondary Tools Section (Settings, Activity Log, Help, Language) */}
                    <div className="py-1.5 px-2 border-t border-[#D4AF37]/20 space-y-0.5">
                      <div className="px-3 pt-1 pb-0.5 text-[10px] font-display font-bold text-[#8C6E52] tracking-wide">
                        الأدوات والتفضيلات
                      </div>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setActiveUtilityDrawer('settings');
                        }}
                        className="w-full px-3 py-2 rounded-xl hover:bg-[#F7F2E9] flex items-center gap-3 text-right transition-colors cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-lg bg-[#F4ECE0] text-[#8C5327] flex items-center justify-center shrink-0">
                          <Settings className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-display font-bold text-[#252321]">
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
                        className="w-full px-3 py-2 rounded-xl hover:bg-[#F7F2E9] flex items-center gap-3 text-right transition-colors cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-lg bg-[#F4ECE0] text-[#8C5327] flex items-center justify-center shrink-0">
                          <Activity className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-display font-bold text-[#252321]">
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
                        className="w-full px-3 py-2 rounded-xl hover:bg-[#F7F2E9] flex items-center gap-3 text-right transition-colors cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-lg bg-[#F4ECE0] text-[#8C5327] flex items-center justify-center shrink-0">
                          <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-display font-bold text-[#252321]">
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
                        className="w-full px-3 py-2 rounded-xl hover:bg-[#F7F2E9] flex items-center justify-between gap-2 text-right transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-[#F4ECE0] text-[#8C5327] flex items-center justify-center shrink-0">
                            <Globe className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </span>
                          <span className="text-xs font-display font-bold text-[#252321]">
                            تغيير اللغة
                          </span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#FAF3E4] border border-[#C59B27]/40 text-[10px] font-mono font-bold text-[#8C5327] shrink-0">
                          {bilingualLabels ? 'AR / EN' : 'العربية'}
                        </span>
                      </button>
                    </div>

                    {/* Logout Action at Bottom of Dropdown */}
                    {onLogout && (
                      <div className="pt-1.5 mt-0.5 border-t border-[#D4AF37]/20 px-2 pb-1">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            onLogout();
                          }}
                          className="w-full px-3 py-2 rounded-xl hover:bg-red-50 text-red-700 flex items-center gap-3 text-right transition-colors cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-lg bg-red-100/80 text-red-700 flex items-center justify-center shrink-0">
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
        className="md:hidden sticky top-0 z-20 bg-[#FDFBF7]/92 backdrop-blur-lg border-b border-[#D4AF37]/22 shadow-[0_8px_22px_-12px_rgba(88,63,36,0.2)]"
      >
        <div className="relative px-2 py-2">
          {/* Soft Side Gradient Fades Indicating Horizontal Continuation */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-7 bg-gradient-to-r from-[#FDFBF7] via-[#FDFBF7]/80 to-transparent z-10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-[#FDFBF7] via-[#FDFBF7]/80 to-transparent z-10"
          />

          <nav
            aria-label="تبويبات لوحة تحكم العميل للجوال"
            className="w-full flex items-center overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth touch-pan-x px-1"
          >
            {renderPrimaryNavigationTabs(true)}
          </nav>
        </div>
      </div>

      {/* MAIN DASHBOARD WORKSPACE */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeUtilityDrawer !== null ? (
          <div className="rounded-2xl bg-white border border-[#B98A78]/45 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#B98A78]/25">
              <div>
                <p className="text-xs font-semibold text-[#D8755B] mb-1">
                  {activeUtilityDrawer === 'profile' &&
                    'الملف الشخصي والبيانات العائلية والجغرافية'}
                  {activeUtilityDrawer === 'settings' &&
                    'إعدادات الحساب والأمان والخصوصية'}
                  {activeUtilityDrawer === 'cart' && 'الترقيات والمحفظة الرقمية'}
                  {activeUtilityDrawer === 'notifications' &&
                    'التنبيهات والتحديثات الأرشيفية'}
                  {activeUtilityDrawer === 'activity' && 'الأرشيف الزمني للعمليات'}
                  {activeUtilityDrawer === 'help' && 'الدعم والإرشاد المعرفي'}
                </p>
                <h1 className="text-xl sm:text-2xl font-display font-bold text-[#252321]">
                  {activeUtilityDrawer === 'profile' &&
                    'الملف الشخصي والبيانات الجغرافية وصورة الحساب'}
                  {activeUtilityDrawer === 'settings' &&
                    'إعدادات الحساب والأمان والإشعارات'}
                  {activeUtilityDrawer === 'cart' &&
                    'الاشتراكات والمحفظة الرقمية'}
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
                  <div className="inline-flex rounded-xl bg-[#F7F2E9] p-1 border border-[#B98A78]/35">
                    <button
                      type="button"
                      onClick={() => setActiveUtilityDrawer('profile')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-colors cursor-pointer ${
                        activeUtilityDrawer === 'profile'
                          ? 'bg-[#252321] text-white'
                          : 'text-[#252321]/75 hover:text-[#252321]'
                      }`}
                    >
                      👤 الملف الشخصي
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveUtilityDrawer('settings')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-colors cursor-pointer ${
                        activeUtilityDrawer === 'settings'
                          ? 'bg-[#D8755B] text-white'
                          : 'text-[#252321]/75 hover:text-[#252321]'
                      }`}
                    >
                      ⚙️ الأمان والإعدادات
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setActiveUtilityDrawer(null)}
                  className="px-4 py-2 rounded-xl bg-[#EDE6DA] hover:bg-[#D8755B] hover:text-white text-[#252321] text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
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
                <div className="rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/45 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 rounded-full bg-[#252321] text-white flex items-center justify-center overflow-hidden border-2 border-[#D8755B] shadow-md shrink-0">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={result.clientName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-9 h-9 text-[#F3D299]" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-base sm:text-lg font-display font-bold text-[#252321]">
                        1. تغيير وإرفاق صورة الحساب الشخصية
                      </h2>
                      <p className="text-xs text-[#252321]/75 leading-relaxed max-w-xl">
                        تُحفظ صورتك في Firebase وتظهر تلقائياً في كبسولة الهيدر العلوية، وفي عقدة «أمين السجل» داخل عمود نسبي، وفي عقدة «أمين السجل» داخل شجرتي.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <label className="px-4 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer shadow-xs">
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
                  className="rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/40 p-5 sm:p-6 space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#B98A78]/25 pb-3.5">
                    <div>
                      <h2 className="text-base sm:text-lg font-display font-bold text-[#252321]">
                        2. تعديل البيانات الشخصية والجغرافية
                      </h2>
                      <p className="text-xs text-[#252321]/70">
                        تحديث الاسم الثلاثي، رقم الجوال، ودولة الإقامة في حسابك (بيانات اسم العائلة والموطن الأصلي مثبتة لارتباطها بالجذر الموثق)
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        dir="ltr"
                        className="px-2.5 py-1 rounded-lg bg-white border border-[#B98A78]/35 text-[11px] font-mono text-[#8D4925]"
                      >
                        {userEmail}
                      </span>
                      {isEmailVerified ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 text-[11px] font-extrabold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>بريد موثّق ✓</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveUtilityDrawer('settings')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          <span>توثيق البريد في الأمان والإعدادات ←</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#252321] mb-1.5">
                        الاسم الأول *
                      </label>
                      <input
                        type="text"
                        required
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3.5 py-2.5 text-sm text-[#252321]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#252321] mb-1.5">
                        اسم الأب
                      </label>
                      <input
                        type="text"
                        value={editFatherName}
                        onChange={(e) => setEditFatherName(e.target.value)}
                        placeholder="اختياري"
                        className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3.5 py-2.5 text-sm text-[#252321]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#252321] mb-1.5">
                        اسم الجد
                      </label>
                      <input
                        type="text"
                        value={editGrandfatherName}
                        onChange={(e) => setEditGrandfatherName(e.target.value)}
                        placeholder="اختياري"
                        className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3.5 py-2.5 text-sm text-[#252321]"
                      />
                    </div>

                    <div>
                      <label className="flex items-center justify-between gap-1 text-xs font-bold text-[#252321]/80 mb-1.5">
                        <span>اسم العائلة / الشهرة *</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#8D4925]">
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
                        className="w-full rounded-xl bg-[#EDE6DA]/75 border border-[#B98A78]/40 px-3.5 py-2.5 text-sm font-semibold text-[#252321]/70 cursor-not-allowed select-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#252321] mb-1.5">
                        رقم الجوال (للتواصل والإشعارات)
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          dir="ltr"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="+966 5X XXX XXXX"
                          className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3.5 py-2.5 pl-9 text-right text-sm text-[#252321]"
                        />
                        <Phone className="w-4 h-4 text-[#B98A78] absolute left-3 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#252321] mb-1.5">
                        دولة الإقامة
                      </label>
                      <select
                        value={editDefaultCountry}
                        onChange={(e) => setEditDefaultCountry(e.target.value)}
                        className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3.5 py-2.5 text-sm text-[#252321]"
                      >
                        {ORIGIN_COUNTRY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="flex items-center justify-between gap-1 text-xs font-bold text-[#252321]/80 mb-1.5">
                        <span>الموطن الأصلي للعائلة (الدولة والإقليم)</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#8D4925]">
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
                          className="w-full rounded-xl bg-[#EDE6DA]/75 border border-[#B98A78]/40 px-2.5 py-2.5 text-xs font-semibold text-[#252321]/70 cursor-not-allowed select-none"
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
                          className="w-full rounded-xl bg-[#EDE6DA]/75 border border-[#B98A78]/40 px-2.5 py-2.5 text-xs font-semibold text-[#252321]/70 cursor-not-allowed select-none"
                        />
                      </div>
                    </div>
                  </div>

                  {profileSaveFeedback && (
                    <div
                      className={`rounded-xl px-4 py-2.5 text-xs font-bold flex items-center gap-2 ${
                        profileSaveFeedback.startsWith('تعذر')
                          ? 'bg-red-50 border border-red-200 text-red-800'
                          : 'bg-emerald-50 border border-emerald-300 text-emerald-900'
                      }`}
                    >
                      {profileSaveFeedback.startsWith('تعذر') ? (
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      <span>{profileSaveFeedback}</span>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="px-6 py-2.5 rounded-xl bg-[#252321] hover:bg-[#D8755B] text-white text-xs sm:text-sm font-display font-bold transition-colors cursor-pointer disabled:opacity-60"
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
                  <div className="rounded-xl bg-[#FAF6F0] border border-[#B98A78]/45 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#252321]">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#D8755B] shrink-0" />
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
                        className="px-3 py-1 rounded-lg bg-[#252321] hover:bg-[#D8755B] text-white text-[11px] font-display font-bold transition-colors cursor-pointer disabled:opacity-50"
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
                        className="p-1 rounded-lg hover:bg-[#EDE6DA] text-[#252321]/65 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* 1. Non-Blocking Server-Side Email Verification Card (Resend OTP) */}
                <div className="rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/45 p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Mail className="w-4 h-4 text-[#D8755B]" />
                        <h2 className="text-sm sm:text-base font-display font-extrabold text-[#252321]">
                          1. حالة وتوثيق البريد الإلكتروني المرتبط بالحساب
                        </h2>
                        <span
                          dir="ltr"
                          className="px-2.5 py-0.5 rounded-lg bg-white border border-[#B98A78]/35 text-xs font-mono text-[#8D4925]"
                        >
                          {userEmail}
                        </span>
                        {isEmailVerified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 text-[11px] font-extrabold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>موثّق ✓</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-bold">
                            <span>غير موثّق</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#252321]/70">
                        {isEmailVerified
                          ? `البريد الإلكتروني موثّق ومعتمد رسمياً${
                              emailVerifiedAt
                                ? ` منذ ${new Date(emailVerifiedAt).toLocaleDateString('ar-SA')}`
                                : ''
                            } — النشر العام وحماية المحفظة مفعّلان بالكامل.`
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
                        className="px-4 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer shrink-0 disabled:opacity-55"
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
                      className="pt-3 border-t border-[#B98A78]/25 flex flex-col sm:flex-row sm:items-center gap-2.5"
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
                        className="sm:w-64 rounded-xl bg-white border border-[#B98A78]/55 px-4 py-2 text-center font-mono text-sm tracking-widest text-[#252321] focus:outline-none focus:border-[#D8755B]"
                      />
                      <button
                        type="submit"
                        disabled={isVerifyingOtpCode}
                        className="px-5 py-2 rounded-xl bg-[#252321] hover:bg-[#D8755B] text-white text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
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
                          ? 'bg-emerald-50 border border-emerald-300 text-emerald-950'
                          : verificationFeedback.type === 'diagnostic'
                          ? 'bg-amber-50 border border-amber-300 text-amber-950'
                          : 'bg-red-50 border border-red-200 text-red-800'
                      }`}
                    >
                      {verificationFeedback.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
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
                    className="rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/40 p-5 sm:p-6 space-y-4"
                  >
                    <div className="flex items-center gap-2.5 border-b border-[#B98A78]/25 pb-3">
                      <KeyRound className="w-5 h-5 text-[#D8755B]" />
                      <div>
                        <h2 className="text-base font-display font-bold text-[#252321]">
                          2. الأمان وتغيير كلمة المرور
                        </h2>
                        <p className="text-xs text-[#252321]/70">
                          تحديث كلمة مرور حسابك في Firebase Authentication
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {!isGoogleOnlyPasswordlessSession && (
                        <div>
                          <label className="block text-xs font-bold text-[#252321] mb-1">
                            كلمة المرور الحالية *
                          </label>
                          <input
                            type="password"
                            dir="ltr"
                            autoComplete="current-password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="أدخل كلمة المرور الحالية للتحقق"
                            className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3.5 py-2 text-right text-sm text-[#252321]"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-[#252321] mb-1">
                          كلمة المرور الجديدة *
                        </label>
                        <input
                          type="password"
                          dir="ltr"
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="6 خانات على الأقل"
                          className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3.5 py-2 text-right text-sm text-[#252321]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#252321] mb-1">
                          تأكيد كلمة المرور الجديدة *
                        </label>
                        <input
                          type="password"
                          dir="ltr"
                          autoComplete="new-password"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder="أعد كتابة كلمة المرور الجديدة"
                          className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3.5 py-2 text-right text-sm text-[#252321]"
                        />
                      </div>
                    </div>

                    {passwordFeedback && (
                      <div
                        className={`rounded-xl px-3.5 py-2.5 text-xs font-bold flex items-start gap-2 ${
                          passwordFeedback.type === 'success'
                            ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
                            : 'bg-red-50 border border-red-200 text-red-700'
                        }`}
                      >
                        {passwordFeedback.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        )}
                        <span>{passwordFeedback.text}</span>
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={isChangingPassword}
                        className="px-5 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
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
                  <div className="rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/40 p-5 sm:p-6 flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2.5 border-b border-[#B98A78]/25 pb-3">
                        <Bell className="w-5 h-5 text-[#D8755B]" />
                        <div>
                          <h2 className="text-base font-display font-bold text-[#252321]">
                            3. إدارة الإشعارات البريدية
                          </h2>
                          <p className="text-xs text-[#252321]/70">
                            تحكم في التنبيهات المرسلة إلى بريدك ({userEmail})
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-white border border-[#B98A78]/35 cursor-pointer">
                          <div>
                            <div className="text-xs sm:text-sm font-display font-bold text-[#252321]">
                              إشعارات تحديث تذاكر البحث والتحقيق النسبي
                            </div>
                            <div className="text-[11px] text-[#252321]/65 mt-0.5">
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
                            className="w-4 h-4 accent-[#D8755B] rounded cursor-pointer shrink-0"
                          />
                        </label>

                        <label className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-white border border-[#B98A78]/35 cursor-pointer">
                          <div>
                            <div className="text-xs sm:text-sm font-display font-bold text-[#252321]">
                              إشعارات إضافات وتحديثات شجرة العائلة (شجرتي)
                            </div>
                            <div className="text-[11px] text-[#252321]/65 mt-0.5">
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
                            className="w-4 h-4 accent-[#D8755B] rounded cursor-pointer shrink-0"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#B98A78]/20 text-xs text-[#8D4925] font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-[#D8755B]" />
                        <span>تُرسل جميع رموز التوثيق والمراسلات والإشعارات باسم «منصة جذوري» عبر info@Juthori.com</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5. Community Blocked Users Governance (إدارة المستخدمين المحظورين في مجتمعي) */}
                <div className="rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/40 p-5 sm:p-6 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[#252321] font-display font-extrabold text-sm sm:text-base">
                      <ShieldCheck className="w-5 h-5 text-[#8D4925]" />
                      <span>4. إدارة المستخدمين المحظورين في «مجتمعي»</span>
                    </div>
                    <span className="text-xs font-semibold text-[#8D4925] bg-white border border-[#B98A78]/35 px-2.5 py-1 rounded-lg">
                      المحظورون حالياً: {blockedUserIds.length}
                    </span>
                  </div>
                  <p className="text-xs text-[#252321]/75 leading-relaxed">
                    يتم إخفاء منشورات وتعليقات المستخدمين المحظورين فوراً من واجهة «مجتمعي» الخاصة بك، ويمكنك فك الحظر عن أي حساب في أي وقت.
                  </p>

                  {blockedUserIds.length === 0 ? (
                    <div className="rounded-xl bg-white border border-[#B98A78]/30 px-4 py-3 text-xs text-[#252321]/70">
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
                            className="rounded-xl bg-white border border-[#B98A78]/35 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3"
                          >
                            <div>
                              <div className="text-xs sm:text-sm font-display font-bold text-[#252321]">
                                {meta?.name || 'عضو في مجتمعي'}
                              </div>
                              <div className="text-[11px] text-[#252321]/60 font-mono" dir="ltr">
                                {bUid}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUnblockCommunityUser(bUid)}
                              className="px-3.5 py-1.5 rounded-xl bg-[#252321] hover:bg-[#3a3734] text-white text-xs font-display font-bold cursor-pointer transition-colors"
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
                <div className="rounded-2xl bg-red-50/70 border-2 border-red-200 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-red-800 font-display font-extrabold text-base">
                      <ShieldAlert className="w-5 h-5 text-red-600" />
                      <span>5. منطقة الخطر (Danger Zone)</span>
                    </div>
                    <p className="text-xs text-red-900/80 leading-relaxed max-w-2xl">
                      حذف الحساب نهائياً يؤدي إلى إزالة ملفك الشخصي وبيانات جلستك من قاعدة بيانات Firebase وإنهاء الجلسة الحالية فوراً.
                    </p>
                  </div>

                  {!showDeleteAccountConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowDeleteAccountConfirm(true)}
                      className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer shrink-0"
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
                        className="px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-display font-extrabold cursor-pointer disabled:opacity-60"
                      >
                        {isDeletingAccount
                          ? 'جاري حذف الحساب...'
                          : 'تأكيد الحذف النهائي من Firebase'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteAccountConfirm(false)}
                        className="px-3.5 py-2.5 rounded-xl bg-white border border-red-200 text-xs font-bold text-[#252321] cursor-pointer"
                      >
                        تراجع
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeUtilityDrawer === 'cart' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="text-xs font-display font-bold text-[#D8755B] flex items-center gap-1.5">
                    <Crown className="w-4 h-4" />
                    <span>تفعيل باقة بريميوم والترقيات الأساسية</span>
                  </div>
                  {availableCartItems.length === 0 ? (
                    <div className="rounded-xl bg-[#F7F2E9] border border-[#D8755B]/40 p-4 text-sm text-[#252321] font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#D8755B] shrink-0" />
                      <span>
                        أنت مشترك بالفعل في أعلى باقة (عضوية بريميوم ✦) وجميع المزايا مفعّلة في حسابك.
                      </span>
                    </div>
                  ) : (
                    availableCartItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-sm font-display font-bold text-[#252321]">
                            {item.title}
                          </div>
                          <div className="text-xs text-[#252321]/75 mt-0.5">
                            {item.subtitle}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-lg font-display font-bold text-[#252321] tabular-nums">
                            ${item.priceUsd}
                          </span>
                          <button
                            type="button"
                            onClick={
                              item.id === 'root_5_usd'
                                ? handleUnlockRoot5Usd
                                : handleUpgradeAnnualVip
                            }
                            className="px-4 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold cursor-pointer"
                          >
                            إتمام التفعيل الآن
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-5 border-t border-[#B98A78]/30">
                  <WalletView
                    result={result}
                    userId={resolvedCustomerUid}
                    userEmail={userEmail}
                    isVip={caps.isVip}
                    onUpgradeSuccess={handleUpgradeAnnualVip}
                    onLogActivity={appendActivity}
                    externalBalance={walletBalance}
                    highlightedShortfallUsd={walletShortfallUsd}
                    onClearShortfall={() => setWalletShortfallUsd(null)}
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
                    onBalanceChange={(nextBal) => {
                      setWalletBalance(nextBal);
                    }}
                  />
                </div>
              </div>
            )}

            {activeUtilityDrawer === 'notifications' && (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-display font-bold text-[#252321]">
                        {n.title}
                      </div>
                      <div className="text-xs text-[#252321]/75 mt-1">{n.body}</div>
                    </div>
                    {n.actionType === 'unlock_5' && !caps.isRootUnlocked && (
                      <button
                        type="button"
                        onClick={handleUnlockRoot5Usd}
                        className="px-4 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold whitespace-nowrap cursor-pointer"
                      >
                        فتح الجذر ($5)
                      </button>
                    )}
                    {n.actionType === 'upgrade_vip' && !caps.isVip && (
                      <button
                        type="button"
                        onClick={handleUpgradeAnnualVip}
                        className="px-4 py-2 rounded-xl bg-[#252321] hover:bg-[#3a3734] text-white text-xs font-display font-bold whitespace-nowrap cursor-pointer"
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
                          className="px-4 py-2 rounded-xl bg-[#8D4925] hover:bg-[#733A1D] text-white text-xs font-display font-bold whitespace-nowrap cursor-pointer"
                        >
                          متابعة والرد على الباحث ←
                        </button>
                      )}
                  </div>
                ))}
              </div>
            )}

            {activeUtilityDrawer === 'activity' && (
              <div className="space-y-6">
                {/* Official Legal Audit Trail & Electronic Signatures Card */}
                <div className="rounded-2xl bg-[#FAF6F0] border-2 border-[#D8755B]/45 p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/30 pb-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-[#252321] text-[#F3D299] flex items-center justify-center shrink-0">
                        <FileSignature className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-display font-extrabold text-[#252321]">
                          سجل التدقيق القانوني والموافقات الإلكترونية (Audit Trail)
                        </h3>
                        <p className="text-xs text-[#252321]/70">
                          توثيق رسمي مرتبط بحسابك في قواعد بيانات Firebase لعقود أمين السجل وشروط الاستخدام وسياسة الخصوصية
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCharterModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer"
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
                    <div className="rounded-xl bg-white border border-[#B98A78]/35 p-4 text-xs text-[#252321]/75 flex items-center justify-between gap-3">
                      <span>
                        لم يتم تسجيل شهادات توقيع إلكتروني إضافية بعد. يمكنك استعراض وتوقيع عقد أمين السجل لتفعيل بناء الشجرة.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userAuditTrail.map((audit) => (
                        <div
                          key={audit.id}
                          className="rounded-xl bg-white border border-[#B98A78]/40 p-4 space-y-2.5 shadow-2xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                  audit.eventType === 'RECORD_KEEPER_CONTRACT_SIGNATURE'
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                    : 'bg-[#FAF6F0] border-[#B98A78]/50 text-[#8D4925]'
                                }`}
                              >
                                {audit.eventType === 'RECORD_KEEPER_CONTRACT_SIGNATURE'
                                  ? 'عقد أمين السجل الموثّق ✓'
                                  : 'موافقة شروط الاستخدام وسياسة الخصوصية ✓'}
                              </span>
                              <span className="text-xs sm:text-sm font-display font-extrabold text-[#252321]">
                                {audit.documentTitle}
                              </span>
                            </div>
                            <span
                              dir="ltr"
                              className="px-2.5 py-1 rounded-lg bg-[#252321] text-[#F3D299] font-mono text-[11px] font-bold"
                            >
                              {audit.certificateCode}
                            </span>
                          </div>

                          <p className="text-xs text-[#252321]/80 leading-relaxed bg-[#F7F2E9]/70 rounded-lg p-2.5 border border-[#B98A78]/25">
                            {audit.consentStatement}
                          </p>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6E6456] pt-1">
                            <span>
                              الإصدار:{' '}
                              <strong className="font-mono text-[#252321]">
                                {audit.documentVersion}
                              </strong>{' '}
                              · البريد:{' '}
                              <strong className="font-mono text-[#252321]">
                                {audit.userEmail}
                              </strong>
                            </span>
                            <span>
                              عنوان IP:{' '}
                              <strong className="font-mono text-[#252321]" dir="ltr">
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
                  <div className="text-xs font-display font-bold text-[#8D4925]">
                    السجل الزمني للعمليات في الحساب:
                  </div>
                  {activityLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 px-4 py-3 flex items-center justify-between gap-3 text-xs sm:text-sm"
                    >
                      <div>
                        <strong className="text-[#252321]">{entry.action}:</strong>{' '}
                        <span className="text-[#252321]/80">{entry.detail}</span>
                      </div>
                      <span className="text-[#252321]/60 whitespace-nowrap text-xs">
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
          <div className="space-y-4">
            {activeTab === DashboardTab.MyTree && charterSignedBanner && (
              <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-400 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-display font-extrabold text-emerald-950">
                      تم اعتماد توقيعك الإلكتروني وتفعيل صلاحية «رب أسرة / أمين السجل» بنجاح ✓
                    </div>
                    <div className="text-xs text-emerald-900/85 mt-0.5">
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
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-950 text-xs font-bold cursor-pointer"
                  >
                    عرض العقد الموقّع
                  </button>
                  <button
                    type="button"
                    onClick={() => setCharterSignedBanner(null)}
                    aria-label="إخفاء التنبيه"
                    className="p-1.5 rounded-lg hover:bg-emerald-200/60 text-emerald-900 cursor-pointer"
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
              onLogActivity={appendActivity}
              onSyncImmediateParents={onUpdateImmediateParents}
              unlockedCapsules={unlockedCapsules}
              unlockedAddonSourceIds={unlockedAddonSourceIds}
              onRequestUnlockCapsule={handleRequestUnlockCapsule}
              onRequestUnlockAllCapsulesBundle={handleRequestUnlockAllCapsulesBundle}
              walletBalance={walletBalance}
              extraTreeCapacity={extraTreeCapacity}
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
                  `تم خصم $${priceUsd} من رصيد المحفظة ورفع السعة الإجمالية للشجرة إلى ${
                    (caps.maxTreeMembers || 250) + nextExtra
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
      <footer className="border-t border-[#B98A78]/30 bg-[#EDE6DA]/70 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center text-center space-y-3.5">
          <div className="mb-1">
            <JuthoriLogo size="sm" onClick={onBackToLanding} />
          </div>
          <p className="text-base font-display font-medium text-[#252321]/85 max-w-xl">
            ما لا يُوثق اليوم… قد يصبح مجرد رواية غامضة غدًا.
          </p>
          <p className="text-sm text-[#252321]/75 max-w-xl">
            تعمل المنصة من خلال شركة جينيا لاب - الولايات المتحدة الأمريكية.
          </p>
          <div className="space-y-1 pt-2">
            <p className="text-xs text-[#252321]/70">
              منصة الأنساب والإرث العائلي العربي — juthori.com
            </p>
            <p className="text-xs text-[#252321]/70">
              جميع الحقوق محفوظة. جذوري © 2026
            </p>
          </div>
        </div>
      </footer>

      {/* MODAL 1: Locked Premium Tab Prompt */}
      {lockedTabPromptName && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#252321]/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="locked-tab-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/50 p-6 sm:p-7 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 text-[#DC2626] flex items-center justify-center">
                <Lock className="w-5 h-5" aria-hidden="true" />
              </div>
              <button
                type="button"
                onClick={() => setLockedTabPromptName(null)}
                aria-label="إغلاق"
                className="w-9 h-9 rounded-lg hover:bg-[#EDE6DA] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3
              id="locked-tab-modal-title"
              className="text-lg font-display font-bold text-[#252321]"
            >
              تبويب «{lockedTabPromptName}» ضمن مزايا باقة بريميوم السنوية
            </h3>
            <p className="text-sm text-[#252321]/80 leading-relaxed">
              أنت حالياً على العضوية الأساسية. رقِّ حسابك إلى الاشتراك السنوي (بريميوم) لفتح عمود النسب الكامل فوق الجذر وتفعيل خدمات (شجرتي، خزانتي، موقعي، مجتمعي).
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleUpgradeAnnualVip}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-sm font-display font-bold cursor-pointer"
              >
                الترقية الآن إلى بريميوم ($60/سنة)
              </button>
              <button
                type="button"
                onClick={() => setLockedTabPromptName(null)}
                className="py-2.5 px-4 rounded-xl bg-[#EDE6DA] text-[#252321] text-sm font-semibold cursor-pointer"
              >
                البقاء في الباقة الأساسية
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

      {/* MODAL 3: Realistic 3-Step Atomic Checkout & Wallet Payment Modal */}
      <CheckoutModal
        order={activeCheckoutOrder}
        walletBalance={walletBalance}
        onClose={() => setActiveCheckoutOrder(null)}
        onExecutePayment={handleExecuteCheckoutPayment}
        onConfirmSuccess={handleConfirmCheckoutSuccess}
        onQuickTopUpWallet={async (amountUsd) => {
          const activeUid =
            userId ||
            auth.currentUser?.uid ||
            resolvedCustomerUid ||
            `usr_${userEmail.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
          const res = await executeAtomicWalletOperation({
            userId: activeUid,
            userEmail,
            operationType: 'TOPUP',
            amountUsd,
            paymentMethod: 'external',
            descriptionAr: `إيداع فوري ($${amountUsd.toFixed(2)}) عبر بوابة الدفع السريع`,
          });
          setWalletBalance(res.balanceAfter);
          setWalletShortfallUsd(null);
          appendActivity(
            `شحن فوري للمحفظة (${res.transactionId || 'TXN'})`,
            `إيداع $${amountUsd.toFixed(2)} عبر بوابة الدفع السريع — الرصيد بعدها: $${res.balanceAfter.toFixed(2)}`
          );
        }}
      />
    </div>
  );
};
