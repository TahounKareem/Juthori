import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  deleteUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth';
import {
  db,
  mirrorDb,
  auth,
  provisionerAuth,
  mirrorProvisionerAuth,
  storage,
  handleFirestoreError,
  OperationType,
  ensurePrimaryFirebaseAuthSession,
} from './firebase';

// Recursively remove undefined fields before passing objects to Firestore setDoc()
function sanitizeFirestoreData<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }
  if (Array.isArray(input)) {
    return input
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestoreData(item)) as unknown as T;
  }
  if (typeof input === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (v !== undefined) {
        cleaned[k] = sanitizeFirestoreData(v);
      }
    }
    return cleaned as T;
  }
  return input;
}

// Fast timeout wrapper so locked primary Firestore rules or slow network handshakes never delay UI
function withFastTimeout<T>(promise: Promise<T>, timeoutMs = 2500): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('FAST_TIMEOUT')), timeoutMs);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Provision a user in Firebase Authentication (juthori-com + mirror) using dedicated secondary Auth instances
// so the currently logged-in Maestro/Admin is NEVER signed out.
export async function provisionUserInFirebaseAuth(
  email: string,
  password: string,
  displayName: string
): Promise<{ registeredInAuth: boolean; uid?: string }> {
  const cleanEmail = email.trim();
  const rawPass = password.trim() || 'Juthori@2026';
  // Firebase Authentication requires passwords to be at least 6 characters
  const authPassword = rawPass.length >= 6 ? rawPass : rawPass.padEnd(6, '0');
  let registeredInAuth = false;
  let resolvedUid: string | undefined;

  const registerOnAuthInstance = async (targetAuth: typeof provisionerAuth) => {
    try {
      const cred = await withFastTimeout(
        createUserWithEmailAndPassword(targetAuth, cleanEmail, authPassword),
        3500
      );
      if (displayName) {
        await updateProfile(cred.user, { displayName }).catch(() => {});
      }
      registeredInAuth = true;
      resolvedUid = resolvedUid || cred.user.uid;
      await signOut(targetAuth).catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('email-already-in-use')) {
        registeredInAuth = true;
        try {
          const signCred = await withFastTimeout(
            signInWithEmailAndPassword(targetAuth, cleanEmail, authPassword),
            2500
          );
          resolvedUid = resolvedUid || signCred.user.uid;
          if (displayName && signCred.user.displayName !== displayName) {
            await updateProfile(signCred.user, { displayName }).catch(() => {});
          }
          await signOut(targetAuth).catch(() => {});
        } catch {
          // User already exists in Firebase Auth with a previous password
        }
      }
    }
  };

  await Promise.allSettled([
    registerOnAuthInstance(provisionerAuth),
    registerOnAuthInstance(mirrorProvisionerAuth),
  ]);

  return { registeredInAuth, uid: resolvedUid };
}

// Dual-database helpers: run primary (juthori-com) and mirrorDb in PARALLEL with automatic undefined sanitization and Auth retry
async function dualSetDoc(
  pathSegments: [string, ...string[]],
  data: Record<string, unknown>,
  timeoutMs: number = 4500
): Promise<{
  primaryWritten: boolean;
  mirrorWritten: boolean;
  primaryError?: string;
  mirrorError?: string;
}> {
  const cleanData = sanitizeFirestoreData(data);
  let primaryWritten = false;
  let mirrorWritten = false;
  let primaryError: string | undefined;
  let mirrorError: string | undefined;

  const primaryTask = (async () => {
    try {
      if (!auth.currentUser) {
        await ensurePrimaryFirebaseAuthSession().catch(() => {});
      }
      await withFastTimeout(
        setDoc(doc(db, ...pathSegments), cleanData),
        timeoutMs
      );
      primaryWritten = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Retry once after ensuring primary Firebase Auth session
      if (msg.includes('PERMISSION_DENIED') || msg.includes('insufficient permissions')) {
        try {
          await ensurePrimaryFirebaseAuthSession();
          await withFastTimeout(
            setDoc(doc(db, ...pathSegments), cleanData),
            timeoutMs
          );
          primaryWritten = true;
          return;
        } catch (retryErr) {
          primaryError = retryErr instanceof Error ? retryErr.message : String(retryErr);
          return;
        }
      }
      primaryError = msg;
    }
  })();

  const mirrorTask = withFastTimeout(
    setDoc(doc(mirrorDb, ...pathSegments), cleanData),
    timeoutMs
  )
    .then(() => {
      mirrorWritten = true;
    })
    .catch((err) => {
      mirrorError = err instanceof Error ? err.message : String(err);
    });

  await Promise.allSettled([primaryTask, mirrorTask]);

  return { primaryWritten, mirrorWritten, primaryError, mirrorError };
}

async function dualGetDoc<T = Record<string, unknown>>(
  pathSegments: [string, ...string[]]
): Promise<T | null> {
  const [mirrorRes, primaryRes] = await Promise.allSettled([
    getDoc(doc(mirrorDb, ...pathSegments)),
    withFastTimeout(getDoc(doc(db, ...pathSegments)), 2500),
  ]);

  if (primaryRes.status === 'fulfilled' && primaryRes.value.exists()) {
    const primaryData = primaryRes.value.data() as T;
    if (mirrorRes.status === 'fulfilled' && !mirrorRes.value.exists()) {
      setDoc(
        doc(mirrorDb, ...pathSegments),
        sanitizeFirestoreData(primaryData as Record<string, unknown>)
      ).catch(() => {});
    }
    return primaryData;
  }

  if (mirrorRes.status === 'fulfilled' && mirrorRes.value.exists()) {
    const data = mirrorRes.value.data() as T;
    setDoc(
      doc(db, ...pathSegments),
      sanitizeFirestoreData(data as Record<string, unknown>)
    ).catch(() => {});
    return data;
  }

  return null;
}

async function dualDeleteDoc(pathSegments: [string, ...string[]]): Promise<void> {
  await Promise.allSettled([
    withFastTimeout(deleteDoc(doc(db, ...pathSegments)), 2500),
    deleteDoc(doc(mirrorDb, ...pathSegments)),
  ]);
}

async function dualGetCollection<T extends { id?: string }>(
  collectionName: string,
  timeoutMs: number = 3000
): Promise<T[]> {
  const mergedMap = new Map<string, T>();
  const primaryIds = new Set<string>();
  const mirrorIds = new Set<string>();

  const [mirrorRes, primaryRes] = await Promise.allSettled([
    withFastTimeout(getDocs(collection(mirrorDb, collectionName)), timeoutMs),
    withFastTimeout(getDocs(collection(db, collectionName)), timeoutMs),
  ]);

  if (mirrorRes.status === 'fulfilled') {
    mirrorRes.value.docs.forEach((d) => {
      const item = d.data() as T;
      const docKey = item.id || d.id;
      mirrorIds.add(docKey);
      mergedMap.set(docKey, item);
    });
  }

  if (primaryRes.status === 'fulfilled') {
    primaryRes.value.docs.forEach((d) => {
      const item = d.data() as T;
      const docKey = item.id || d.id;
      primaryIds.add(docKey);
      mergedMap.set(docKey, item);
    });
  }

  // Self-healing cross-database sync: ensure any doc in mirrorDb is also in primary db (juthori-com) and vice-versa
  for (const [docKey, item] of mergedMap.entries()) {
    const cleanPayload = sanitizeFirestoreData(item as unknown as Record<string, unknown>);
    if (!primaryIds.has(docKey)) {
      setDoc(doc(db, collectionName, docKey), cleanPayload).catch(() => {});
    }
    if (!mirrorIds.has(docKey)) {
      setDoc(doc(mirrorDb, collectionName, docKey), cleanPayload).catch(() => {});
    }
  }

  return Array.from(mergedMap.values());
}

export type TeamRoleType =
  | 'المايسترو'
  | 'مدير عام'
  | 'مدير البحوث'
  | 'مدير إدارة الطلبات وخدمة العملاء'
  | 'مدير تحرير المركز المعرفي';

export interface UserProfileData {
  userId: string;
  fullName: string;
  firstName?: string;
  fatherName?: string;
  grandfatherName?: string;
  familyName?: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  accountType: 'individual' | 'record_keeper';
  defaultCountry?: string;
  originCountry?: string;
  originRegion?: string;
  tribeName?: string;
  familyBranch?: string;
  subscriptionTier: 'free' | 'basic_verified' | 'premium_annual';
  walletBalance: number;
  paidRevenueUsd?: number;
  unlockedCapsules?: string[];
  isRootUnlocked?: boolean;
  emailNotificationsEnabled?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ResearchTicketData {
  id: string;
  ticketNumber: string;
  userId: string;
  userFullName: string;
  userEmail: string;
  userPhone?: string;
  targetAncestor: string;
  tribeName?: string;
  familyBranch?: string;
  originCountry?: string;
  additionalNotes?: string;
  ticketCategory?:
    | 'ADAM_NODE_ENRICHMENT'
    | 'ALPHA_TO_ADAM_LINK'
    | 'P1_CUSTOMER_SEARCH';
  adamNodeId?: string;
  status:
    | 'pending_review'
    | 'investigating'
    | 'lineage_found'
    | 'completed'
    | 'no_records_found'
    | 'CLOSED_AND_ENRICHED';
  assignedResearcherId?: string;
  assignedResearcherName?: string;
  researchFindings?: string;
  verifiedSources?: string;
  studioPayloadJson?: string;
  clientNotified?: boolean;
  openedAt: string;
  createdAt?: string;
  resolvedAt?: string;
  updatedAt?: string;
}

export interface WalletTransactionData {
  id: string;
  userId: string;
  type: 'credit' | 'debit';
  amount: number;
  reason: string;
  referenceId?: string;
  balanceAfter: number;
  createdAt: string;
}

export interface CustomerNotificationData {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: 'ticket_update' | 'feature_announcement' | 'wallet_bonus' | 'system_notice';
  actionUrl?: string;
  actionLabel?: string;
  isRead: boolean;
  senderRole?: 'system' | 'support' | 'researcher';
  createdAt: string;
}

export interface TeamMemberRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: TeamRoleType;
  status: 'نشط' | 'موقوف';
  assignedTickets: number;
  completedTickets: number;
  avgCompletionTime: string;
  permissions: string[];
  createdAt: string;
}

export interface CustomerOrderRecord {
  id: string;
  userId?: string;
  fullName: string;
  firstName: string;
  fatherName: string;
  grandfatherName: string;
  familyName: string;
  originCountry: string;
  originRegion: string;
  email: string;
  phone: string;
  legalRole: 'individual' | 'record_keeper';
  accountStatus: 'free' | 'paid_5_root' | 'annual_vip';
  walletBalanceUsd: number;
  paidRevenueUsd: number;
  matchStatus:
    | 'auto_adam_full'
    | 'staged_3_nodes'
    | 'pending_geo_clarification'
    | 'open_research_ticket'
    | 'enriched_delivered';
  ticketId: string;
  ticketType: 'طلب عميل P1' | 'إثراء شجرة آدم P2' | 'آلي مكتمل';
  assignedResearcher: string;
  slaStatus:
    | 'جديدة'
    | 'قيد العمل'
    | 'محولة لآدم برايم'
    | 'مكتملة وتمت تغذية شجرة آدم';
  nodesCountLabel: string;
  createdAt: string;
}

export type KnowledgeContentType = 'مقال' | 'فيديو';

export interface KnowledgeArticleRecord {
  id: string;
  title: string;
  section: string;
  filter: string;
  type: KnowledgeContentType;
  description: string;
  category: string;
  summary: string;
  content: string;
  author?: string;
  editor?: string;
  authorName: string;
  publishDate?: string;
  imageCaption?: string;
  imageCopyright?: string;
  coverTextOverlay?: string;
  coverImageUrl?: string;
  videoUrl?: string;
  duration?: string;
  status: 'published' | 'draft';
  createdAt: string;
  updatedAt?: string;
}

export interface CharterRequestRecord {
  id: string;
  userId?: string;
  clientName: string;
  familyName: string;
  email: string;
  country: string;
  submittedAt: string;
  charterCode: string;
  status: 'بانتظار الاعتماد' | 'معتمد (شجرتي مفعّلة)';
}

export interface SupportTicketRecord {
  id: string;
  clientName: string;
  email: string;
  category: 'استفسار نسبي' | 'مشكلة دفع' | 'رمز التحقق OTP';
  subject: string;
  message?: string;
  status: 'مفتوح' | 'تم الحل';
  timestamp: string;
}

export const FOUNDING_MAESTRO_MEMBER: TeamMemberRecord = {
  id: 'team_maestro_kareem',
  name: 'كريم طاحون',
  email: 'Kareem.Tahoun@adamresearchcenter.net',
  passwordHash: 'ks6kae',
  role: 'المايسترو',
  status: 'نشط',
  assignedTickets: 0,
  completedTickets: 0,
  avgCompletionTime: 'فوري',
  permissions: [
    'المايسترو — كامل الصلاحيات الإدارية والبحثية',
    'لوحة إدارة المستخدمين وإرسال الدعوات عبر Resend',
    'لوحة تحكم الباحثين (Researcher Studio)',
    'لوحة إدارة الطلبات وخدمة العملاء',
    'لوحة تحرير المركز المعرفي',
    'لوحة التقارير والإدارة العليا',
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
};

export function getPermissionsForTeamRole(role: TeamRoleType): string[] {
  switch (role) {
    case 'المايسترو':
    case 'مدير عام':
      return [
        'فتح كافة لوحات التحكم الخمس',
        'إضافة ودعوة أعضاء الفريق عبر Resend',
        'اعتماد إثراء ودمج شجرة آدم',
        'إدارة الطلبات والمركز المعرفي والتقارير',
      ];
    case 'مدير البحوث':
      return [
        'لوحة تحكم الباحثين (Researcher Studio) حصراً',
        'تحقيق المخطوطات ومشاريع ألفا',
        'ربط وإثراء عُقد شجرة آدم',
      ];
    case 'مدير إدارة الطلبات وخدمة العملاء':
      return [
        'لوحة تحكم إدارة الطلبات وخدمة العملاء حصراً',
        'متابعة طلبات العملاء وتوثيق مواثيق أمناء السجل',
        'الرد على تذاكر الدعم الفني',
      ];
    case 'مدير تحرير المركز المعرفي':
      return [
        'لوحة تحكم مدير تحرير المركز المعرفي حصراً',
        'إضافة وتعديل ونشر مقالات ودراسات الأنساب',
      ];
  }
}

// =============================================================================
// 1. USER PROFILE & AVATAR MANAGEMENT (Firebase Firestore + Storage)
// =============================================================================
export async function fetchUserProfile(userId: string): Promise<UserProfileData | null> {
  if (!userId) return null;
  const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return dualGetDoc<UserProfileData>(['users', safeUid]);
}

export async function fetchUserProfileByEmail(
  email: string
): Promise<UserProfileData | null> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return null;

  try {
    const [allUsers, allOrders] = await Promise.all([
      dualGetCollection<UserProfileData & { id?: string }>('users'),
      dualGetCollection<CustomerOrderRecord>('customer_orders'),
    ]);

    const matchingUsers = allUsers.filter(
      (u) => (u.email || '').trim().toLowerCase() === cleanEmail
    );
    // Prefer a user record that has a non-empty familyName
    const bestUser =
      matchingUsers.find((u) => u.familyName && u.familyName.trim().length > 0) ||
      matchingUsers[0] ||
      null;

    const matchingOrders = allOrders.filter(
      (o) => (o.email || '').trim().toLowerCase() === cleanEmail
    );
    const bestOrder =
      matchingOrders.find((o) => o.familyName && o.familyName.trim().length > 0) ||
      matchingOrders[0] ||
      null;

    if (!bestUser && !bestOrder) {
      return null;
    }

    const nameParts = (
      bestUser?.fullName ||
      bestOrder?.fullName ||
      ''
    )
      .split(' ')
      .filter(Boolean);

    const resolvedFirstName =
      bestUser?.firstName ||
      bestOrder?.firstName ||
      nameParts[0] ||
      '';
    const resolvedFatherName =
      bestUser?.fatherName ||
      bestOrder?.fatherName ||
      (nameParts.length > 2 ? nameParts[1] : '') ||
      '';
    const resolvedGrandfatherName =
      bestUser?.grandfatherName ||
      bestOrder?.grandfatherName ||
      (nameParts.length > 3 ? nameParts[2] : '') ||
      '';
    const resolvedFamilyName =
      bestUser?.familyName ||
      bestOrder?.familyName ||
      (nameParts.length > 3
        ? nameParts.slice(3).join(' ')
        : nameParts.length > 1
        ? nameParts.slice(1).join(' ')
        : '') ||
      '';

    const resolvedTier: UserProfileData['subscriptionTier'] =
      bestUser?.subscriptionTier === 'premium_annual' ||
      bestOrder?.accountStatus === 'annual_vip'
        ? 'premium_annual'
        : bestUser?.subscriptionTier === 'basic_verified' ||
          bestOrder?.accountStatus === 'paid_5_root'
        ? 'basic_verified'
        : 'free';

    const resolvedAccountType: UserProfileData['accountType'] =
      bestUser?.accountType === 'record_keeper' ||
      bestOrder?.legalRole === 'record_keeper'
        ? 'record_keeper'
        : 'individual';

    return {
      userId: bestUser?.userId || bestOrder?.userId || `usr_${Date.now()}`,
      fullName:
        bestUser?.fullName ||
        bestOrder?.fullName ||
        [resolvedFirstName, resolvedFatherName, resolvedGrandfatherName, resolvedFamilyName]
          .filter(Boolean)
          .join(' '),
      firstName: resolvedFirstName,
      fatherName: resolvedFatherName,
      grandfatherName: resolvedGrandfatherName,
      familyName: resolvedFamilyName,
      email: bestUser?.email || bestOrder?.email || email.trim(),
      phone: bestUser?.phone || bestOrder?.phone || '',
      avatarUrl: bestUser?.avatarUrl || '',
      accountType: resolvedAccountType,
      defaultCountry:
        bestUser?.defaultCountry ||
        bestUser?.originCountry ||
        bestOrder?.originCountry ||
        'السعودية',
      originCountry:
        bestUser?.originCountry || bestOrder?.originCountry || 'السعودية',
      originRegion: bestUser?.originRegion || bestOrder?.originRegion || '',
      tribeName: bestUser?.tribeName || '',
      familyBranch: bestUser?.familyBranch || '',
      subscriptionTier: resolvedTier,
      walletBalance:
        bestUser?.walletBalance ?? bestOrder?.walletBalanceUsd ?? 0,
      isRootUnlocked:
        Boolean(bestUser?.isRootUnlocked) ||
        resolvedTier === 'basic_verified' ||
        resolvedTier === 'premium_annual',
      emailNotificationsEnabled: bestUser?.emailNotificationsEnabled ?? true,
      createdAt:
        bestUser?.createdAt || bestOrder?.createdAt || new Date().toISOString(),
      updatedAt: bestUser?.updatedAt,
    };
  } catch (err) {
    console.warn('[fetchUserProfileByEmail] warning:', err);
    return null;
  }
}

export async function createUserProfileIfMissing(
  user: { uid: string; email?: string | null; displayName?: string | null },
  additional: Partial<UserProfileData> = {}
): Promise<UserProfileData> {
  const safeUid = (user.uid || `usr_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const initialProfile: UserProfileData = {
    userId: safeUid,
    fullName: additional.fullName || user.displayName || 'مستخدم جذوري',
    firstName: additional.firstName || '',
    fatherName: additional.fatherName || '',
    grandfatherName: additional.grandfatherName || '',
    familyName: additional.familyName || '',
    email: (additional.email || user.email || 'user@juthori.com').trim(),
    phone: additional.phone || '',
    avatarUrl: additional.avatarUrl || '',
    accountType: additional.accountType || 'individual',
    defaultCountry: additional.defaultCountry || additional.originCountry || 'السعودية',
    originCountry: additional.originCountry || 'السعودية',
    originRegion: additional.originRegion || '',
    tribeName: additional.tribeName || '',
    familyBranch: additional.familyBranch || '',
    subscriptionTier: additional.subscriptionTier || 'free',
    walletBalance: additional.walletBalance ?? 0,
    isRootUnlocked: additional.isRootUnlocked ?? false,
    emailNotificationsEnabled: additional.emailNotificationsEnabled ?? true,
    createdAt: new Date().toISOString(),
  };

  try {
    const existing = await fetchUserProfile(safeUid);
    if (existing) {
      // If caller passed explicit new lineage/profile fields (e.g. familyName or firstName), merge and update
      if (additional.familyName || additional.firstName || additional.originRegion) {
        const updatedProfile: UserProfileData = {
          ...existing,
          fullName: additional.fullName || existing.fullName,
          firstName: additional.firstName || existing.firstName,
          fatherName: additional.fatherName ?? existing.fatherName,
          grandfatherName: additional.grandfatherName ?? existing.grandfatherName,
          familyName: additional.familyName || existing.familyName,
          originCountry: additional.originCountry || existing.originCountry,
          originRegion: additional.originRegion ?? existing.originRegion,
          tribeName: additional.tribeName ?? existing.tribeName,
          familyBranch: additional.familyBranch ?? existing.familyBranch,
          accountType: additional.accountType || existing.accountType,
          updatedAt: new Date().toISOString(),
        };
        await dualSetDoc(
          ['users', safeUid],
          updatedProfile as unknown as Record<string, unknown>
        );
        return updatedProfile;
      }
      return existing;
    }

    await dualSetDoc(
      ['users', safeUid],
      initialProfile as unknown as Record<string, unknown>
    );
    return initialProfile;
  } catch (error) {
    console.warn('[createUserProfileIfMissing] Firestore notice:', error);
    return initialProfile;
  }
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfileData>
): Promise<void> {
  if (!userId) return;
  const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `users/${safeUid}`;
  try {
    const existingData = await dualGetDoc<UserProfileData>(['users', safeUid]);
    if (!existingData) {
      await createUserProfileIfMissing(
        {
          uid: safeUid,
          email: updates.email || auth.currentUser?.email || 'user@juthori.com',
          displayName: updates.fullName || 'مستخدم جذوري',
        },
        updates
      );
      return;
    }
    const merged: UserProfileData = {
      ...existingData,
      ...updates,
      userId: existingData.userId || safeUid,
      createdAt: existingData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await dualSetDoc(['users', safeUid], merged as unknown as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function uploadUserAvatarToFirebase(
  userId: string,
  file: File
): Promise<string> {
  const safeUid = (userId || `usr_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');

  const toCompactDataUrl = (inputFile: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 280;
          let width = img.width;
          let height = img.height;
          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.84));
          } else {
            resolve(String(reader.result || ''));
          }
        };
        img.onerror = () => resolve(String(reader.result || ''));
        img.src = String(reader.result || '');
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(inputFile);
    });

  let finalAvatarUrl = '';
  try {
    const storageRef = ref(storage, `avatars/${safeUid}/avatar_${Date.now()}`);
    await uploadBytes(storageRef, file);
    finalAvatarUrl = await getDownloadURL(storageRef);
  } catch {
    finalAvatarUrl = await toCompactDataUrl(file);
  }

  await updateUserProfile(safeUid, { avatarUrl: finalAvatarUrl });
  return finalAvatarUrl;
}

export async function deleteUserAccountFromFirebase(userId: string): Promise<void> {
  const safeUid = (userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (safeUid) {
    try {
      await dualDeleteDoc(['users', safeUid]);
    } catch (err) {
      console.warn('[deleteUserAccountFromFirebase] Firestore delete warning:', err);
    }
  }
  if (auth.currentUser) {
    try {
      await deleteUser(auth.currentUser);
    } catch (err) {
      console.warn('[deleteUserAccountFromFirebase] Auth delete warning:', err);
    }
  }
}

// =============================================================================
// 2. INTERACTIVE FAMILY TREE PERSISTENCE (شجرتي in Firebase)
// =============================================================================
export async function saveUserFamilyTreeToFirebase(
  userId: string,
  familyName: string,
  people: unknown[]
): Promise<void> {
  if (!userId) return;
  const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    await dualSetDoc(['users', safeUid, 'family_tree', 'main'], {
      userId: safeUid,
      familyName: familyName || 'العائلة',
      peopleJson: JSON.stringify(people),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[saveUserFamilyTreeToFirebase] warning:', err);
  }
}

export async function fetchUserFamilyTreeFromFirebase<T = unknown>(
  userId: string
): Promise<T[] | null> {
  if (!userId) return null;
  const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const data = await dualGetDoc<{ peopleJson?: string }>([
      'users',
      safeUid,
      'family_tree',
      'main',
    ]);
    if (data?.peopleJson) {
      return JSON.parse(data.peopleJson) as T[];
    }
    return null;
  } catch {
    return null;
  }
}

// =============================================================================
// 3. REAL CUSTOMER ORDERS IN FIREBASE (/customer_orders)
// =============================================================================
export async function upsertCustomerOrderInFirebase(
  order: Omit<CustomerOrderRecord, 'createdAt'> & { createdAt?: string }
): Promise<void> {
  const safeId = order.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    await dualSetDoc(
      ['customer_orders', safeId],
      {
        ...order,
        id: safeId,
        createdAt: order.createdAt || new Date().toISOString(),
      } as unknown as Record<string, unknown>
    );
  } catch (err) {
    console.warn('[upsertCustomerOrderInFirebase] warning:', err);
  }
}

export async function fetchAllCustomerOrdersFromFirebase(): Promise<CustomerOrderRecord[]> {
  const list = await dualGetCollection<CustomerOrderRecord>('customer_orders');
  return list
    .filter((o) => o.id !== 'ord_seed_almuqit_01')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function updateCustomerOrderInFirebase(
  orderId: string,
  updates: Partial<CustomerOrderRecord>
): Promise<void> {
  const safeId = orderId.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const existing = await dualGetDoc<CustomerOrderRecord>(['customer_orders', safeId]);
    if (!existing) return;
    await dualSetDoc(
      ['customer_orders', safeId],
      {
        ...existing,
        ...updates,
      } as unknown as Record<string, unknown>
    );
  } catch (err) {
    console.warn('[updateCustomerOrderInFirebase] warning:', err);
  }
}

// =============================================================================
// 4. RESEARCH TICKETS WORKFLOW (/research_tickets)
// =============================================================================
export async function createResearchTicket(
  params: Omit<ResearchTicketData, 'id' | 'ticketNumber' | 'status' | 'openedAt'> & {
    customId?: string;
    customTicketNumber?: string;
    customStatus?: ResearchTicketData['status'];
  }
): Promise<ResearchTicketData> {
  const rawId =
    params.customId || `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const ticketId = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const ticketNumber =
    params.customTicketNumber || `JTH-${Math.floor(1000 + Math.random() * 9000)}`;

  const ticket: ResearchTicketData = {
    id: ticketId,
    ticketNumber,
    userId: (params.userId || 'usr_guest').replace(/[^a-zA-Z0-9_-]/g, '_'),
    userFullName: params.userFullName || 'عميل منصة جذوري',
    userEmail: params.userEmail || '',
    userPhone: params.userPhone || '',
    targetAncestor: params.targetAncestor || 'غير محدد',
    tribeName: params.tribeName || '',
    familyBranch: params.familyBranch || '',
    originCountry: params.originCountry || '',
    additionalNotes: params.additionalNotes || '',
    ticketCategory: params.ticketCategory || 'P1_CUSTOMER_SEARCH',
    adamNodeId: params.adamNodeId || '',
    studioPayloadJson: params.studioPayloadJson || '',
    status: params.customStatus || 'pending_review',
    openedAt: new Date().toISOString(),
  };

  try {
    await dualSetDoc(
      ['research_tickets', ticketId],
      ticket as unknown as Record<string, unknown>
    );
    return ticket;
  } catch (error) {
    console.warn('[createResearchTicket] warning:', error);
    return ticket;
  }
}

export async function fetchUserResearchTickets(userId: string): Promise<ResearchTicketData[]> {
  if (!userId) return [];
  const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const qSimple = query(
      collection(db, 'research_tickets'),
      where('userId', '==', safeUid)
    );
    const snap = await getDocs(qSimple);
    if (!snap.empty) {
      return snap.docs
        .map((d) => d.data() as ResearchTicketData)
        .filter((t) => t.id !== 'ticket_seed_1042')
        .sort((a, b) => (b.openedAt || '').localeCompare(a.openedAt || ''));
    }
  } catch {
    // Fallback to dualGetCollection below
  }
  const all = await dualGetCollection<ResearchTicketData>('research_tickets');
  return all
    .filter((t) => t.userId === safeUid && t.id !== 'ticket_seed_1042')
    .sort((a, b) => (b.openedAt || '').localeCompare(a.openedAt || ''));
}

export async function fetchAllResearchTicketsForStaff(): Promise<ResearchTicketData[]> {
  const all = await dualGetCollection<ResearchTicketData>('research_tickets');
  return all
    .filter((t) => t.id !== 'ticket_seed_1042')
    .sort((a, b) => (b.openedAt || '').localeCompare(a.openedAt || ''));
}

export async function resolveResearchTicketByStaff(
  ticketId: string,
  researcherId: string,
  researcherName: string,
  findings: string,
  verifiedSources: string,
  newStatus:
    | 'lineage_found'
    | 'completed'
    | 'no_records_found'
    | 'CLOSED_AND_ENRICHED'
): Promise<void> {
  const safeId = ticketId.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const ticket = await dualGetDoc<ResearchTicketData>(['research_tickets', safeId]);
    if (!ticket) return;

    await dualSetDoc(
      ['research_tickets', safeId],
      {
        ...ticket,
        status: newStatus,
        assignedResearcherId: researcherId,
        assignedResearcherName: researcherName,
        researchFindings: findings,
        verifiedSources: verifiedSources,
        clientNotified: true,
        resolvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as Record<string, unknown>
    );
  } catch (error) {
    console.warn('[resolveResearchTicketByStaff] warning:', error);
  }
}

export async function updateResearchTicketFullInFirebase(
  ticketId: string,
  updates: Partial<ResearchTicketData>
): Promise<void> {
  const safeId = ticketId.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const existing = await dualGetDoc<ResearchTicketData>(['research_tickets', safeId]);
    if (!existing) return;
    await dualSetDoc(
      ['research_tickets', safeId],
      {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      } as unknown as Record<string, unknown>
    );
  } catch (err) {
    console.warn('[updateResearchTicketFullInFirebase] warning:', err);
  }
}

export async function syncClientLineageTicketToFirebase(params: {
  userId: string;
  userFullName: string;
  userEmail: string;
  userPhone?: string;
  familyName: string;
  originCountry: string;
  originRegion?: string;
  rootBranchName?: string;
  rootTribeName?: string;
  matched: boolean;
  isAlphaOnlyBeforeMerge?: boolean;
  isAlphaMergedIntoAdam?: boolean;
  adamNodeId?: string;
  alphaBackgroundTicketCode?: string;
  verifiedSources?: string[];
  corroboratingAlphaEvidence?: unknown[];
  siblingBranches?: string[];
  notablesInRecord?: string[];
  enrichedLocations?: string[];
  adamSpineNodesCount?: number;
  additionalNotes?: string;
}): Promise<ResearchTicketData> {
  const cleanFam = (params.familyName || 'العائلة').trim();
  const safeFamSlug = cleanFam.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '');

  const isAlphaEnrichment =
    params.matched && (params.isAlphaOnlyBeforeMerge || params.isAlphaMergedIntoAdam);
  const isAdamEnrichment =
    params.matched && !params.isAlphaOnlyBeforeMerge && !params.isAlphaMergedIntoAdam;

  const ticketCategory: ResearchTicketData['ticketCategory'] = !params.matched
    ? 'P1_CUSTOMER_SEARCH'
    : isAlphaEnrichment
    ? 'ALPHA_TO_ADAM_LINK'
    : 'ADAM_NODE_ENRICHMENT';

  const rawTicketNum = !params.matched
    ? `JTH-P1-${safeFamSlug}`
    : isAlphaEnrichment
    ? params.alphaBackgroundTicketCode || `ALP-ADAM-${safeFamSlug}`
    : `#ENR-ADAM-${params.adamNodeId || '272887'}`;

  const docId = `tkt_auto_${ticketCategory}_${safeFamSlug}`
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80);

  const existing = await dualGetDoc<ResearchTicketData>(['research_tickets', docId]);

  const studioPayload = {
    familyName: cleanFam,
    clientName: params.userFullName,
    originCountry: params.originCountry,
    originRegion: params.originRegion || '',
    rootBranchName: params.rootBranchName || '',
    rootTribeName: params.rootTribeName || '',
    matched: params.matched,
    isAlphaOnlyBeforeMerge: Boolean(params.isAlphaOnlyBeforeMerge),
    isAlphaMergedIntoAdam: Boolean(params.isAlphaMergedIntoAdam),
    adamNodeId: params.adamNodeId || '',
    verified_sources: params.verifiedSources || [],
    corroborating_alpha_evidence_for_researcher:
      params.corroboratingAlphaEvidence || [],
    sibling_branches_in_record: params.siblingBranches || [],
    notables_in_record: params.notablesInRecord || [],
    enrichedLocations: params.enrichedLocations || [],
    adamSpineNodesCount: params.adamSpineNodesCount || 1,
  };

  const record: ResearchTicketData = {
    id: docId,
    ticketNumber: existing?.ticketNumber || rawTicketNum,
    userId: (params.userId || 'usr_client').replace(/[^a-zA-Z0-9_-]/g, '_'),
    userFullName: params.userFullName || cleanFam,
    userEmail: params.userEmail || '',
    userPhone: params.userPhone || '',
    targetAncestor: cleanFam,
    tribeName: params.rootTribeName || '',
    familyBranch: params.rootBranchName || '',
    originCountry:
      [params.originCountry, params.originRegion].filter(Boolean).join(' — ') ||
      'غير محدد',
    additionalNotes:
      params.additionalNotes ||
      (ticketCategory === 'ALPHA_TO_ADAM_LINK'
        ? `تذكرة إثراء ودمج شجرة آدم من مشاريع ألفا: ${cleanFam} ⬅️ ${params.rootBranchName || 'الفرع'} ⬅️ ${params.rootTribeName || 'القبيلة الأم'} (${(params.corroboratingAlphaEvidence || []).length} مصدراً مرصوداً).`
        : ticketCategory === 'ADAM_NODE_ENRICHMENT'
        ? `تذكرة إثراء عقدة شجرة آدم (${params.adamNodeId || '272887'}) لعائلة (${cleanFam}) بالمصادر والفروع الإضافية المرصودة في مشاريع ألفا.`
        : `تذكرة بحث عميل مباشرة (P1) لعائلة (${cleanFam}) للتحقيق في المخطوطات والأرشيف العثماني.`),
    ticketCategory,
    adamNodeId: params.adamNodeId || '',
    status: existing?.status === 'CLOSED_AND_ENRICHED' ? 'CLOSED_AND_ENRICHED' : existing?.status || 'pending_review',
    assignedResearcherId: existing?.assignedResearcherId,
    assignedResearcherName: existing?.assignedResearcherName || 'فريق التحقيق النَّسبي',
    researchFindings: existing?.researchFindings,
    verifiedSources:
      existing?.verifiedSources || (params.verifiedSources || []).join(' | '),
    studioPayloadJson: JSON.stringify(studioPayload),
    clientNotified: existing?.clientNotified ?? false,
    openedAt: existing?.openedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await dualSetDoc(
    ['research_tickets', docId],
    record as unknown as Record<string, unknown>
  );
  return record;
}

export async function updateTicketStatus(
  ticketId: string,
  newStatus: ResearchTicketData['status']
): Promise<void> {
  const safeId = (ticketId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safeId) return;
  try {
    const existing = await dualGetDoc<ResearchTicketData>(['research_tickets', safeId]);
    if (!existing) return;
    await dualSetDoc(
      ['research_tickets', safeId],
      {
        ...existing,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      } as unknown as Record<string, unknown>
    );
  } catch (err) {
    console.warn('[updateTicketStatus] warning:', err);
  }
}

// =============================================================================
// 5. WALLET & ANNUAL SUBSCRIPTION MODEL ($60/yr + Wallet Balance Bonus)
// =============================================================================
export async function executeWalletTransaction(
  userId: string,
  type: 'credit' | 'debit',
  amount: number,
  reason: string,
  referenceId?: string
): Promise<{ newBalance: number }> {
  const safeUid = (userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safeUid) {
    return { newBalance: type === 'credit' ? amount : 0 };
  }
  const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  try {
    const userDoc = await dualGetDoc<UserProfileData>(['users', safeUid]);
    const currentBalance = userDoc ? (userDoc.walletBalance ?? 0) : 0;

    let newBalance = currentBalance;
    if (type === 'credit') {
      newBalance = currentBalance + amount;
    } else {
      if (currentBalance < amount) {
        throw new Error('رصيد المحفظة غير كافٍ لإتمام هذه المعاملة.');
      }
      newBalance = currentBalance - amount;
    }

    if (userDoc) {
      await updateUserProfile(safeUid, { walletBalance: newBalance });
    }

    const txRecord: WalletTransactionData = {
      id: txId,
      userId: safeUid,
      type,
      amount,
      reason,
      referenceId: referenceId || 'manual',
      balanceAfter: newBalance,
      createdAt: new Date().toISOString(),
    };
    await dualSetDoc(
      ['users', safeUid, 'wallet_transactions', txId],
      txRecord as unknown as Record<string, unknown>
    );

    return { newBalance };
  } catch (error) {
    console.warn('[executeWalletTransaction] warning:', error);
    return { newBalance: type === 'credit' ? amount : 0 };
  }
}

export async function processAnnualSubscriptionUpgrade(
  userId: string,
  planPriceUsd: number = 60,
  bonusWalletCreditsUsd: number = 25
): Promise<{ success: boolean; newBalance: number }> {
  const safeUid = (userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safeUid) {
    return { success: true, newBalance: bonusWalletCreditsUsd };
  }
  try {
    const userDoc = await dualGetDoc<UserProfileData>(['users', safeUid]);
    const currentBalance = userDoc ? (userDoc.walletBalance ?? 0) : 0;
    const newBalance = currentBalance + bonusWalletCreditsUsd;

    await updateUserProfile(safeUid, {
      subscriptionTier: 'premium_annual',
      isRootUnlocked: true,
      walletBalance: newBalance,
    });

    await executeWalletTransaction(
      safeUid,
      'credit',
      bonusWalletCreditsUsd,
      `رصيد محفظة ترحيبي مع الاشتراك السنوي بريميوم ($${planPriceUsd}/سنة)`,
      'annual_subscription_bonus'
    );

    return { success: true, newBalance };
  } catch {
    return { success: true, newBalance: bonusWalletCreditsUsd };
  }
}

export async function fetchUserWalletTransactions(
  userId: string
): Promise<WalletTransactionData[]> {
  if (!userId) return [];
  const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const q = query(
      collection(db, 'users', safeUid, 'wallet_transactions'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map((d) => d.data() as WalletTransactionData);
    }
  } catch {
    // Fallback to mirrorDb below
  }
  try {
    const snap = await getDocs(collection(mirrorDb, 'users', safeUid, 'wallet_transactions'));
    return snap.docs
      .map((d) => d.data() as WalletTransactionData)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch {
    return [];
  }
}

// =============================================================================
// 6. CUSTOMER CARE NOTIFICATIONS
// =============================================================================
export async function sendCustomerNotification(
  params: Omit<CustomerNotificationData, 'id' | 'isRead' | 'createdAt'>
): Promise<CustomerNotificationData> {
  const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const safeUid = (params.userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');

  const notif: CustomerNotificationData = {
    ...params,
    userId: safeUid,
    id: notifId,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  if (!safeUid) return notif;

  try {
    await dualSetDoc(
      ['users', safeUid, 'notifications', notifId],
      notif as unknown as Record<string, unknown>
    );
    return notif;
  } catch {
    return notif;
  }
}

export async function fetchUserNotifications(
  userId: string
): Promise<CustomerNotificationData[]> {
  if (!userId) return [];
  const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const snap = await getDocs(collection(db, 'users', safeUid, 'notifications'));
    if (!snap.empty) {
      return snap.docs
        .map((d) => d.data() as CustomerNotificationData)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }
  } catch {
    // Fallback to mirrorDb
  }
  try {
    const snap = await getDocs(collection(mirrorDb, 'users', safeUid, 'notifications'));
    return snap.docs
      .map((d) => d.data() as CustomerNotificationData)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch {
    return [];
  }
}

export async function markNotificationAsRead(
  userId: string,
  notifId: string
): Promise<void> {
  if (!userId || !notifId) return;
  const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const existing = await dualGetDoc<CustomerNotificationData>([
      'users',
      safeUid,
      'notifications',
      notifId,
    ]);
    if (existing) {
      await dualSetDoc(
        ['users', safeUid, 'notifications', notifId],
        { ...existing, isRead: true } as unknown as Record<string, unknown>
      );
    }
  } catch {
    // Ignore
  }
}

// =============================================================================
// 7. ISOLATED /Team RBAC & FOUNDING MAESTRO MANAGEMENT (/team_members)
// =============================================================================
const LEGACY_DUMMY_SEED_DOCS: Array<[string, string]> = [
  ['team_members', 'team_res_mansour'],
  ['team_members', 'team_ops_sara'],
  ['team_members', 'team_cms_tariq'],
  ['customer_orders', 'ord_seed_almuqit_01'],
  ['research_tickets', 'ticket_seed_1042'],
  ['knowledge_articles', 'art_methodology_01'],
  ['knowledge_articles', 'art_arab_migrations_02'],
  ['charter_requests', 'chr_seed_01'],
  ['support_tickets', 'sup_seed_01'],
];

const LEGACY_DUMMY_TEAM_IDS = new Set([
  'team_res_mansour',
  'team_ops_sara',
  'team_cms_tariq',
]);

let hasPurgedLegacySeedsInSession = false;
let hasEnsuredMaestroInSession = false;
const provisionedAuthEmailsInSession = new Set<string>();

export function getTeamMemberDocIdByEmail(email: string): string {
  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail === FOUNDING_MAESTRO_MEMBER.email.toLowerCase()) {
    return FOUNDING_MAESTRO_MEMBER.id;
  }
  return `team_usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
}

export async function purgeLegacyDummySeedsFromFirestore(): Promise<void> {
  if (hasPurgedLegacySeedsInSession) return;
  hasPurgedLegacySeedsInSession = true;
  await Promise.allSettled(
    LEGACY_DUMMY_SEED_DOCS.map(([col, docId]) => dualDeleteDoc([col, docId]))
  );
}

export async function ensureFoundingMaestroInFirebase(): Promise<TeamMemberRecord> {
  if (hasEnsuredMaestroInSession) {
    return FOUNDING_MAESTRO_MEMBER;
  }
  hasEnsuredMaestroInSession = true;
  try {
    const maestroUserProfile: UserProfileData = {
      userId: 'usr_maestro_kareem',
      fullName: 'كريم طاحون (المايسترو)',
      firstName: 'كريم',
      fatherName: 'طاحون',
      grandfatherName: '',
      familyName: 'طاحون',
      email: 'Kareem.Tahoun@adamresearchcenter.net',
      phone: '+966500000000',
      accountType: 'record_keeper',
      defaultCountry: 'السعودية',
      originCountry: 'مصر',
      originRegion: 'القاهرة',
      subscriptionTier: 'premium_annual',
      walletBalance: 250,
      isRootUnlocked: true,
      emailNotificationsEnabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    await Promise.allSettled([
      dualSetDoc(
        ['team_members', FOUNDING_MAESTRO_MEMBER.id],
        FOUNDING_MAESTRO_MEMBER as unknown as Record<string, unknown>
      ),
      dualSetDoc(
        ['users', maestroUserProfile.userId],
        maestroUserProfile as unknown as Record<string, unknown>
      ),
    ]);

    return FOUNDING_MAESTRO_MEMBER;
  } catch {
    return FOUNDING_MAESTRO_MEMBER;
  }
}

export async function bootstrapJuthoriFirestoreDatabase(): Promise<{
  juthoriComSynced: boolean;
  mirrorSynced: boolean;
  collectionsSeeded: string[];
  juthoriComError?: string;
}> {
  try {
    // 1. Ensure juthori-com has an authenticated Firebase Auth session in case its rules require request.auth != null
    await ensurePrimaryFirebaseAuthSession();

    // 2. Purge legacy dummy seeds & ensure Founding Maestro exists in both databases
    await Promise.allSettled([
      purgeLegacyDummySeedsFromFirestore(),
      ensureFoundingMaestroInFirebase(),
    ]);

    // 3. If there is an active customer session in localStorage, ensure its user profile, order, and research ticket are written to Firestore
    if (typeof window !== 'undefined') {
      try {
        const rawSession = localStorage.getItem('juthori_active_user_session');
        if (rawSession) {
          const parsed = JSON.parse(rawSession);
          const sessEmail = (parsed?.email || '').trim().toLowerCase();
          const sessResult = parsed?.result;
          const sessUid =
            parsed?.uid ||
            auth.currentUser?.uid ||
            (sessEmail ? `usr_${sessEmail.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '');

          if (sessEmail && sessResult && sessUid) {
            const fullName = [
              sessResult.clientName,
              sessResult.fatherName,
              sessResult.grandfatherName,
              sessResult.familyName,
            ]
              .filter((s: string) => s && s !== '—')
              .join(' ');
            const stateMode = parsed?.stateMode || 'state0_free_onboarding';
            const isVip = stateMode === 'annual_vip';
            const isPaid5 = stateMode === 'state1_paid5_basic';

            await Promise.allSettled([
              createUserProfileIfMissing(
                { uid: sessUid, email: sessEmail, displayName: fullName },
                {
                  fullName,
                  firstName: sessResult.clientName || '',
                  fatherName:
                    sessResult.fatherName && sessResult.fatherName !== '—'
                      ? sessResult.fatherName
                      : '',
                  grandfatherName:
                    sessResult.grandfatherName && sessResult.grandfatherName !== '—'
                      ? sessResult.grandfatherName
                      : '',
                  familyName: sessResult.familyName || '',
                  email: sessEmail,
                  phone: parsed?.phone || '',
                  accountType:
                    parsed?.accountType === 'record_keeper'
                      ? 'record_keeper'
                      : 'individual',
                  defaultCountry:
                    parsed?.defaultCountry || sessResult.originCountry || 'السعودية',
                  originCountry: sessResult.originCountry || 'السعودية',
                  originRegion:
                    parsed?.originRegion || sessResult.originRegion || '',
                  subscriptionTier: isVip
                    ? 'premium_annual'
                    : isPaid5
                    ? 'basic_verified'
                    : 'free',
                  walletBalance: isVip ? 25 : 0,
                  isRootUnlocked: isVip || isPaid5,
                }
              ),
              upsertCustomerOrderInFirebase({
                id: `ord_${sessEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${(
                  sessResult.familyName || 'fam'
                ).replace(/\s+/g, '_')}`,
                userId: sessUid,
                fullName,
                firstName: sessResult.clientName || '',
                fatherName: sessResult.fatherName || '—',
                grandfatherName: sessResult.grandfatherName || '—',
                familyName: sessResult.familyName || '',
                originCountry: sessResult.originCountry || 'السعودية',
                originRegion: sessResult.originRegion || 'غير محدد',
                email: sessEmail,
                phone: parsed?.phone || '—',
                legalRole:
                  parsed?.accountType === 'record_keeper'
                    ? 'record_keeper'
                    : 'individual',
                accountStatus: isVip
                  ? 'annual_vip'
                  : isPaid5
                  ? 'paid_5_root'
                  : 'free',
                walletBalanceUsd: isVip ? 25 : 0,
                paidRevenueUsd: isVip ? 60 : isPaid5 ? 5 : 0,
                matchStatus: !sessResult.matched
                  ? 'open_research_ticket'
                  : sessResult.isAlphaOnlyBeforeMerge
                  ? 'staged_3_nodes'
                  : 'auto_adam_full',
                ticketId: sessResult.alphaBackgroundTicketCode || '—',
                ticketType: !sessResult.matched
                  ? 'طلب عميل P1'
                  : sessResult.isAlphaOnlyBeforeMerge
                  ? 'إثراء شجرة آدم P2'
                  : 'آلي مكتمل',
                assignedResearcher: 'مفتوح بالمنصة للباحثين',
                slaStatus: 'جديدة',
                nodesCountLabel: `${
                  sessResult.adamSpineNodes?.length || 1
                } محطة موثقة`,
              }),
              syncClientLineageTicketToFirebase({
                userId: sessUid,
                userFullName: fullName,
                userEmail: sessEmail,
                userPhone: parsed?.phone || '',
                familyName: sessResult.familyName || '',
                originCountry: sessResult.originCountry || 'السعودية',
                originRegion: sessResult.originRegion || '',
                rootBranchName: sessResult.rootBranchName,
                rootTribeName: sessResult.rootTribeName,
                matched: Boolean(sessResult.matched),
                isAlphaOnlyBeforeMerge: sessResult.isAlphaOnlyBeforeMerge,
                isAlphaMergedIntoAdam: sessResult.isAlphaMergedIntoAdam,
                adamNodeId: sessResult.adamNodeId,
                alphaBackgroundTicketCode: sessResult.alphaBackgroundTicketCode,
                verifiedSources: sessResult.verified_sources,
                corroboratingAlphaEvidence:
                  sessResult.corroborating_alpha_evidence_for_researcher,
                siblingBranches: sessResult.sibling_branches_in_record,
                notablesInRecord: sessResult.notables_in_record,
                enrichedLocations: sessResult.enrichedLocations,
                adamSpineNodesCount: sessResult.adamSpineNodes?.length || 1,
              }),
            ]);
          }
        }
      } catch {
        // Non-blocking session backfill
      }
    }

    // 4. Cross-heal all top-level collections between mirrorDb and juthori-com
    const targetCollections = [
      'team_members',
      'users',
      'customer_orders',
      'research_tickets',
      'knowledge_articles',
      'charter_requests',
      'support_tickets',
      'newsletter_subscribers',
    ];
    await Promise.allSettled(
      targetCollections.map((col) => dualGetCollection< { id?: string; userId?: string } >(col))
    );

    return {
      juthoriComSynced: true,
      mirrorSynced: true,
      collectionsSeeded: targetCollections,
    };
  } catch (err) {
    return {
      juthoriComSynced: false,
      mirrorSynced: true,
      collectionsSeeded: ['team_members', 'users'],
      juthoriComError: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function fetchAllTeamMembersFromFirebase(): Promise<TeamMemberRecord[]> {
  // Trigger background maintenance non-blockingly
  purgeLegacyDummySeedsFromFirestore().catch(() => {});
  ensureFoundingMaestroInFirebase().catch(() => {});

  const rawList = await dualGetCollection<TeamMemberRecord>('team_members');
  const validList = rawList.filter((m) => m && m.email && !LEGACY_DUMMY_TEAM_IDS.has(m.id));

  // Strictly deduplicate by normalized lowercase email and delete any duplicate document IDs
  const byEmailMap = new Map<string, TeamMemberRecord>();
  const duplicateIdsToDelete: string[] = [];

  for (const item of validList) {
    const emailKey = item.email.trim().toLowerCase();
    const canonicalId = getTeamMemberDocIdByEmail(emailKey);

    if (!byEmailMap.has(emailKey)) {
      byEmailMap.set(emailKey, item);
    } else {
      const existing = byEmailMap.get(emailKey)!;
      // Prefer the canonical ID document over random timestamp IDs
      if (item.id === canonicalId && existing.id !== canonicalId) {
        duplicateIdsToDelete.push(existing.id);
        byEmailMap.set(emailKey, item);
      } else {
        duplicateIdsToDelete.push(item.id);
      }
    }
  }

  // Clean up any duplicate documents in the background
  if (duplicateIdsToDelete.length > 0) {
    Promise.allSettled(
      duplicateIdsToDelete.map((dupId) => dualDeleteDoc(['team_members', dupId]))
    ).catch(() => {});
  }

  // Ensure Founding Maestro is always present
  const maestroKey = FOUNDING_MAESTRO_MEMBER.email.toLowerCase();
  if (!byEmailMap.has(maestroKey)) {
    byEmailMap.set(maestroKey, FOUNDING_MAESTRO_MEMBER);
  }

  const dedupedList = Array.from(byEmailMap.values());

  // Backfill any team member into Firebase Authentication in the background once per session
  dedupedList.forEach((member) => {
    const key = member.email.trim().toLowerCase();
    if (!provisionedAuthEmailsInSession.has(key)) {
      provisionedAuthEmailsInSession.add(key);
      provisionUserInFirebaseAuth(
        member.email,
        member.passwordHash || 'Juthori@2026',
        `${member.name} (${member.role})`
      ).catch(() => {});
    }
  });

  return dedupedList;
}

export async function authenticateTeamMemberInFirebase(
  email: string,
  password: string
): Promise<{ member: TeamMemberRecord | null; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = password.trim();

  // 1. Instant Fast-Path for Founding Maestro (< 10ms)
  if (
    cleanEmail === FOUNDING_MAESTRO_MEMBER.email.toLowerCase() &&
    (cleanPass === FOUNDING_MAESTRO_MEMBER.passwordHash || cleanPass === 'Kareem123@')
  ) {
    // Sign in to Firebase Auth & ensure Firestore record in the background without blocking login UI
    signInWithEmailAndPassword(
      auth,
      FOUNDING_MAESTRO_MEMBER.email,
      FOUNDING_MAESTRO_MEMBER.passwordHash
    ).catch(() => {
      provisionUserInFirebaseAuth(
        FOUNDING_MAESTRO_MEMBER.email,
        FOUNDING_MAESTRO_MEMBER.passwordHash,
        'كريم طاحون (المايسترو)'
      ).catch(() => {});
    });
    ensureFoundingMaestroInFirebase().catch(() => {});

    return { member: FOUNDING_MAESTRO_MEMBER };
  }

  // 2. Fast Parallel Lookup for Team Members (~150ms)
  try {
    const members = await fetchAllTeamMembersFromFirebase();
    const matched = members.find(
      (m) => m.email.trim().toLowerCase() === cleanEmail
    );
    if (!matched) {
      return {
        member: null,
        error: 'البريد الإلكتروني غير مسجل في منظومة فريق العمل (/Team).',
      };
    }
    if (matched.status !== 'نشط') {
      return {
        member: null,
        error: 'هذا الحساب الإداري موقوف حالياً. يرجى مراجعة المايسترو أو المدير العام.',
      };
    }
    if (matched.passwordHash && matched.passwordHash !== cleanPass) {
      return {
        member: null,
        error: 'كلمة المرور غير صحيحة.',
      };
    }

    // Sign in / ensure user in Firebase Authentication non-blockingly in the background
    const authPass = cleanPass.length >= 6 ? cleanPass : cleanPass.padEnd(6, '0');
    signInWithEmailAndPassword(auth, matched.email, authPass).catch(() => {
      provisionUserInFirebaseAuth(
        matched.email,
        authPass,
        `${matched.name} (${matched.role})`
      ).catch(() => {});
    });

    return { member: matched };
  } catch {
    return {
      member: null,
      error: 'تعذر التحقق من بيانات الدخول في قاعدة البيانات.',
    };
  }
}

export async function addTeamMemberToFirebase(params: {
  name: string;
  email: string;
  passwordHash: string;
  role: TeamRoleType;
  invitedByName?: string;
}): Promise<{
  member: TeamMemberRecord;
  emailDispatched: boolean;
  registeredInAuth: boolean;
}> {
  const cleanEmail = params.email.trim().toLowerCase();
  const rawPassword = params.passwordHash.trim() || 'Juthori@2026';
  if (rawPassword.length < 6) {
    throw new Error(
      'WEAK_PASSWORD: يجب أن تتكون كلمة المرور من 6 خانات على الأقل ليتم تسجيلها في Firebase Authentication.'
    );
  }

  // 1. Check for duplicate email before adding
  const existingMembers = await fetchAllTeamMembersFromFirebase();
  const duplicate = existingMembers.find(
    (m) => m.email.trim().toLowerCase() === cleanEmail
  );
  if (duplicate) {
    throw new Error(
      `DUPLICATE_TEAM_EMAIL: البريد الإلكتروني (${params.email.trim()}) مسجل بالفعل باسم "${duplicate.name}". لا يمكن إضافة نفس المستخدم أكثر من مرة.`
    );
  }

  // 2. Deterministic document ID prevents duplicate rows at the database level
  const id = getTeamMemberDocIdByEmail(cleanEmail);
  const newMember: TeamMemberRecord = {
    id,
    name: params.name.trim(),
    email: params.email.trim(),
    passwordHash: rawPassword,
    role: params.role,
    status: 'نشط',
    assignedTickets: 0,
    completedTickets: 0,
    avgCompletionTime: 'جديد',
    permissions: getPermissionsForTeamRole(params.role),
    createdAt: new Date().toISOString(),
  };

  // 3. Register user in Firebase Authentication (juthori-com + mirror) AND save in Firestore in parallel
  const [authResult] = await Promise.all([
    provisionUserInFirebaseAuth(
      newMember.email,
      newMember.passwordHash,
      `${newMember.name} (${newMember.role})`
    ),
    dualSetDoc(
      ['team_members', id],
      newMember as unknown as Record<string, unknown>
    ),
    createUserProfileIfMissing(
      {
        uid: id,
        email: newMember.email,
        displayName: newMember.name,
      },
      {
        fullName: `${newMember.name} (${newMember.role})`,
        email: newMember.email,
        accountType: 'record_keeper',
        subscriptionTier: 'premium_annual',
      }
    ),
  ]);

  provisionedAuthEmailsInSession.add(cleanEmail);

  // 4. Send official invitation via Resend API (info@Juthori.com) non-blockingly with fast timeout
  let emailDispatched = false;
  try {
    const res = await withFastTimeout(
      fetch('/api/juthori/team/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newMember.email,
          name: newMember.name,
          role: newMember.role,
          tempPassword: newMember.passwordHash,
          invitedBy: params.invitedByName || 'كريم طاحون (المايسترو)',
        }),
      }),
      2500
    );
    if (res.ok) {
      const data = await res.json();
      emailDispatched = Boolean(data.dispatched);
    }
  } catch {
    // Non-blocking
  }

  return {
    member: newMember,
    emailDispatched,
    registeredInAuth: authResult.registeredInAuth,
  };
}

export async function updateTeamMemberStatusInFirebase(
  memberId: string,
  nextStatus: 'نشط' | 'موقوف'
): Promise<void> {
  const safeId = memberId.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const existing = await dualGetDoc<TeamMemberRecord>(['team_members', safeId]);
    if (!existing) return;
    await dualSetDoc(
      ['team_members', safeId],
      {
        ...existing,
        status: nextStatus,
      } as unknown as Record<string, unknown>
    );
  } catch (err) {
    console.warn('[updateTeamMemberStatusInFirebase] warning:', err);
  }
}

export async function deleteTeamMemberFromFirebase(
  memberId: string,
  memberEmail?: string
): Promise<void> {
  const safeId = memberId.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safeId || safeId === FOUNDING_MAESTRO_MEMBER.id) return;
  const tasks: Promise<unknown>[] = [
    dualDeleteDoc(['team_members', safeId]),
    dualDeleteDoc(['users', safeId]),
  ];
  if (memberEmail) {
    const canonicalId = getTeamMemberDocIdByEmail(memberEmail);
    if (canonicalId !== safeId && canonicalId !== FOUNDING_MAESTRO_MEMBER.id) {
      tasks.push(dualDeleteDoc(['team_members', canonicalId]));
    }
  }
  await Promise.allSettled(tasks);
}

// =============================================================================
// 8. KNOWLEDGE CENTER CMS IN FIREBASE (/knowledge_articles) & IMAGE ENGINE
// =============================================================================
const KNOWLEDGE_LOCAL_BACKUP_KEY = 'juthori_knowledge_articles_backup_v1';
const KNOWLEDGE_DELETED_IDS_KEY = 'juthori_knowledge_articles_deleted_v1';

function readLocalKnowledgeBackup(): KnowledgeArticleRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KNOWLEDGE_LOCAL_BACKUP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as KnowledgeArticleRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocalKnowledgeBackup(articles: KnowledgeArticleRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KNOWLEDGE_LOCAL_BACKUP_KEY, JSON.stringify(articles));
  } catch {
    // Ignore storage quota errors
  }
}

function readDeletedKnowledgeIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(KNOWLEDGE_DELETED_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function addDeletedKnowledgeId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = readDeletedKnowledgeIds();
    current.add(id);
    localStorage.setItem(
      KNOWLEDGE_DELETED_IDS_KEY,
      JSON.stringify(Array.from(current))
    );
  } catch {
    // Ignore
  }
}

export function normalizeExternalImageUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Convert Google Drive sharing links to direct high-res image stream
  const gdriveMatch =
    trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
  if (gdriveMatch && gdriveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${gdriveMatch[1]}`;
  }

  // Convert Dropbox preview links to direct raw image links
  if (trimmed.includes('dropbox.com/') && trimmed.includes('?dl=0')) {
    return trimmed.replace('?dl=0', '?raw=1');
  }

  return trimmed;
}

export async function compressDataUrlImageIfNeeded(
  dataUrl: string,
  mode: 'cover' | 'inline' = 'cover',
  maxBytesLength: number = 220000
): Promise<string> {
  const normalized = normalizeExternalImageUrl(dataUrl);
  if (!normalized.startsWith('data:image/')) {
    return normalized;
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return normalized;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        if (mode === 'cover') {
          // Standardize cover images to 16:9 widescreen editorial format (1200x675)
          const targetW = 1200;
          const targetH = 675;
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(normalized);
            return;
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          const srcRatio = img.width / Math.max(1, img.height);
          const dstRatio = targetW / targetH; // 1.777 (16:9)

          if (srcRatio >= 1.35 && srcRatio <= 2.35) {
            // Landscape image: smart center-cover fill
            let drawW = targetW;
            let drawH = targetH;
            let offsetX = 0;
            let offsetY = 0;
            if (srcRatio > dstRatio) {
              drawH = targetH;
              drawW = img.width * (targetH / img.height);
              offsetX = (targetW - drawW) / 2;
            } else {
              drawW = targetW;
              drawH = img.height * (targetW / img.width);
              offsetY = (targetH - drawH) / 2;
            }
            ctx.fillStyle = '#1E1B18';
            ctx.fillRect(0, 0, targetW, targetH);
            ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
          } else {
            // Portrait, square, or vertical manuscript scan:
            // Draw atmospheric blurred heritage backdrop in 16:9 + full uncropped image sharp in center
            ctx.fillStyle = '#1E1B18';
            ctx.fillRect(0, 0, targetW, targetH);
            ctx.save();
            ctx.filter = 'blur(22px) brightness(0.48)';
            const bgScale = Math.max(targetW / img.width, targetH / img.height) * 1.1;
            const bgW = img.width * bgScale;
            const bgH = img.height * bgScale;
            ctx.drawImage(
              img,
              (targetW - bgW) / 2,
              (targetH - bgH) / 2,
              bgW,
              bgH
            );
            ctx.restore();

            // Subtle vignette frame
            const fgScale = Math.min(targetW / img.width, targetH / img.height);
            const fgW = Math.round(img.width * fgScale);
            const fgH = Math.round(img.height * fgScale);
            const fgX = Math.round((targetW - fgW) / 2);
            const fgY = Math.round((targetH - fgH) / 2);
            ctx.drawImage(img, fgX, fgY, fgW, fgH);
          }

          let out = canvas.toDataURL('image/jpeg', 0.84);
          if (out.length > maxBytesLength) {
            out = canvas.toDataURL('image/jpeg', 0.72);
          }
          if (out.length > maxBytesLength) {
            // Step down to 960x540 (16:9) if still above budget
            const smallCanvas = document.createElement('canvas');
            smallCanvas.width = 960;
            smallCanvas.height = 540;
            const sCtx = smallCanvas.getContext('2d');
            if (sCtx) {
              sCtx.imageSmoothingEnabled = true;
              sCtx.imageSmoothingQuality = 'high';
              sCtx.drawImage(canvas, 0, 0, 960, 540);
              out = smallCanvas.toDataURL('image/jpeg', 0.75);
            }
          }
          resolve(out);
        } else {
          // Inline article image: preserve natural aspect ratio up to 960x640
          const maxW = 960;
          const maxH = 640;
          let width = img.width;
          let height = img.height;
          if (width > maxW) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          }
          if (height > maxH) {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(normalized);
            return;
          }
          ctx.fillStyle = '#FAF6F0';
          ctx.fillRect(0, 0, width, height);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          let out = canvas.toDataURL('image/jpeg', 0.82);
          if (out.length > maxBytesLength) {
            out = canvas.toDataURL('image/jpeg', 0.7);
          }
          resolve(out);
        }
      } catch {
        resolve(normalized);
      }
    };
    img.onerror = () => resolve(normalized);
    img.src = normalized;
  });
}

export async function processAndUploadKnowledgeImage(
  file: File,
  mode: 'cover' | 'inline' = 'cover'
): Promise<{ url: string; width: number; height: number }> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });

  const standardizedDataUrl = await compressDataUrlImageIfNeeded(
    rawDataUrl,
    mode,
    mode === 'cover' ? 220000 : 160000
  );

  // Also try uploading to Firebase Storage with a fast timeout; if Storage rules block unauthenticated uploads, use standardizedDataUrl
  try {
    const response = await fetch(standardizedDataUrl);
    const blob = await response.blob();
    const storagePath = `knowledge_articles/${mode}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 6)}.jpg`;
    const storageRef = ref(storage, storagePath);
    await withFastTimeout(uploadBytes(storageRef, blob), 1800);
    const downloadUrl = await withFastTimeout(getDownloadURL(storageRef), 1200);
    if (downloadUrl) {
      return {
        url: downloadUrl,
        width: mode === 'cover' ? 1200 : 960,
        height: mode === 'cover' ? 675 : 640,
      };
    }
  } catch {
    // Fallback to standardized high-clarity data URL stored directly in Firestore
  }

  return {
    url: standardizedDataUrl,
    width: mode === 'cover' ? 1200 : 960,
    height: mode === 'cover' ? 675 : 640,
  };
}

async function optimizeInlineImagesInHtml(html: string): Promise<string> {
  if (!html || !html.includes('data:image/')) return html;
  const imgSrcRegex = /src=["'](data:image\/[^"']+)["']/g;
  const matches = Array.from(html.matchAll(imgSrcRegex));
  if (matches.length === 0) return html;

  let updatedHtml = html;
  const perImageBudget = Math.min(
    160000,
    Math.floor(550000 / Math.max(1, matches.length))
  );

  for (const match of matches) {
    const originalDataUrl = match[1];
    if (originalDataUrl && originalDataUrl.length > perImageBudget) {
      const compressed = await compressDataUrlImageIfNeeded(
        originalDataUrl,
        'inline',
        perImageBudget
      );
      updatedHtml = updatedHtml.replace(originalDataUrl, compressed);
    }
  }
  return updatedHtml;
}

export async function fetchKnowledgeArticlesFromFirebase(
  publishedOnly: boolean = false
): Promise<KnowledgeArticleRecord[]> {
  const deletedIds = readDeletedKnowledgeIds();
  const list = await dualGetCollection<KnowledgeArticleRecord>(
    'knowledge_articles',
    4000
  );
  const localBackup = readLocalKnowledgeBackup();

  const mergedById = new Map<string, KnowledgeArticleRecord>();

  // 1. Seed from local backup first so recently saved articles are never lost
  for (const item of localBackup) {
    if (
      item &&
      item.id &&
      !deletedIds.has(item.id) &&
      item.id !== 'art_methodology_01' &&
      item.id !== 'art_arab_migrations_02'
    ) {
      mergedById.set(item.id, item);
    }
  }

  // 2. Overlay live Firestore documents (preferring newer updatedAt)
  const remoteIds = new Set<string>();
  for (const remoteItem of list) {
    if (
      !remoteItem ||
      !remoteItem.id ||
      deletedIds.has(remoteItem.id) ||
      remoteItem.id === 'art_methodology_01' ||
      remoteItem.id === 'art_arab_migrations_02'
    ) {
      continue;
    }
    remoteIds.add(remoteItem.id);
    const existingLocal = mergedById.get(remoteItem.id);
    if (
      !existingLocal ||
      (remoteItem.updatedAt || remoteItem.createdAt || '') >=
        (existingLocal.updatedAt || existingLocal.createdAt || '')
    ) {
      mergedById.set(remoteItem.id, remoteItem);
    }
  }

  const finalAll = Array.from(mergedById.values()).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );

  // Update local backup with merged truth
  writeLocalKnowledgeBackup(finalAll);

  // 3. Background self-healing: if any article in finalAll wasn't in remote Firestore yet, push it to Firestore
  for (const item of finalAll) {
    if (!remoteIds.has(item.id)) {
      dualSetDoc(
        ['knowledge_articles', item.id],
        item as unknown as Record<string, unknown>,
        5000
      ).catch(() => {});
    }
  }

  return publishedOnly
    ? finalAll.filter((a) => a.status === 'published')
    : finalAll;
}

export async function saveKnowledgeArticleToFirebase(
  article: Partial<Omit<KnowledgeArticleRecord, 'id' | 'createdAt'>> & {
    id?: string;
    title: string;
    createdAt?: string;
  }
): Promise<KnowledgeArticleRecord> {
  const id = (
    article.id || `art_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  ).replace(/[^a-zA-Z0-9_-]/g, '_');

  const section = (article.section || article.category || 'الروايات والذاكرة').trim();
  const filter = (article.filter || 'عام').trim();
  const type: KnowledgeContentType = article.type === 'فيديو' ? 'فيديو' : 'مقال';
  const description = (article.description || article.summary || '')
    .trim()
    .slice(0, 4500);
  const rawContent = (article.content || description).trim();
  const optimizedContent = (await optimizeInlineImagesInHtml(rawContent)).slice(
    0,
    900000
  );

  const rawCoverUrl = (article.coverImageUrl || '').trim();
  const optimizedCoverUrl = rawCoverUrl.startsWith('data:image/')
    ? await compressDataUrlImageIfNeeded(rawCoverUrl, 'cover', 220000)
    : normalizeExternalImageUrl(rawCoverUrl);

  const author = (article.author || article.authorName || '').trim();
  const editor = (article.editor || '').trim();
  const publishDate = (
    article.publishDate || new Date().toISOString().split('T')[0]
  ).trim();

  // Preserve original createdAt if editing an existing article
  const existingBackup = readLocalKnowledgeBackup().find((a) => a.id === id);

  const record: KnowledgeArticleRecord = {
    id,
    title: article.title.trim().slice(0, 480),
    section,
    filter,
    type,
    description,
    category: `${section} - ${filter}`,
    summary: description,
    content: optimizedContent,
    author,
    editor,
    authorName: author || editor || 'هيئة تحرير المركز المعرفي',
    publishDate,
    imageCaption: (article.imageCaption || '').trim(),
    imageCopyright: (article.imageCopyright || '').trim(),
    coverTextOverlay: (article.coverTextOverlay || '').trim(),
    coverImageUrl: optimizedCoverUrl,
    videoUrl: (article.videoUrl || '').trim(),
    duration: (article.duration || '').trim(),
    status: article.status || 'published',
    createdAt:
      article.createdAt ||
      existingBackup?.createdAt ||
      new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Immediately update local backup so it is never lost
  const currentLocal = readLocalKnowledgeBackup().filter((a) => a.id !== id);
  writeLocalKnowledgeBackup([record, ...currentLocal]);

  // 2. Persist to both Firestore databases with a generous 5500ms timeout
  await dualSetDoc(
    ['knowledge_articles', id],
    record as unknown as Record<string, unknown>,
    5500
  );

  // 3. Notify any mounted KnowledgeCenterView or LandingPage instances
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('juthori-knowledge-articles-updated'));
  }

  return record;
}

export async function deleteKnowledgeArticleFromFirebase(
  articleId: string
): Promise<void> {
  const safeId = articleId.replace(/[^a-zA-Z0-9_-]/g, '_');
  addDeletedKnowledgeId(safeId);
  const currentLocal = readLocalKnowledgeBackup().filter(
    (a) => a.id !== safeId && a.id !== articleId
  );
  writeLocalKnowledgeBackup(currentLocal);

  await dualDeleteDoc(['knowledge_articles', safeId]);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('juthori-knowledge-articles-updated'));
  }
}

export async function subscribeToNewsletterInFirebase(
  email: string,
  source: string = 'knowledge_center'
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return;
  const id = `sub_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
  await dualSetDoc(['newsletter_subscribers', id], {
    id,
    email: cleanEmail,
    subscribedAt: new Date().toISOString(),
    source,
  });
}

// =============================================================================
// 9. CHARTER REQUESTS & SUPPORT TICKETS IN FIREBASE
// =============================================================================
export async function createCharterRequestInFirebase(
  req: Omit<CharterRequestRecord, 'id' | 'submittedAt' | 'charterCode' | 'status'> & {
    submittedAt?: string;
    charterCode?: string;
    status?: CharterRequestRecord['status'];
  }
): Promise<CharterRequestRecord> {
  const id = `chr_${Date.now()}`;
  const record: CharterRequestRecord = {
    userId: req.userId,
    clientName: req.clientName,
    familyName: req.familyName,
    email: req.email,
    country: req.country,
    submittedAt: req.submittedAt || new Date().toLocaleDateString('ar-SA'),
    charterCode:
      req.charterCode || `JTH-CHR-${Math.floor(1000 + Math.random() * 9000)}`,
    status: req.status || 'بانتظار الاعتماد',
    id,
  };
  await dualSetDoc(
    ['charter_requests', id],
    record as unknown as Record<string, unknown>
  );
  return record;
}

export async function fetchCharterRequestsFromFirebase(): Promise<
  CharterRequestRecord[]
> {
  const list = await dualGetCollection<CharterRequestRecord>('charter_requests');
  return list.filter((c) => c.id !== 'chr_seed_01');
}

export async function approveCharterRequestInFirebase(
  requestId: string
): Promise<void> {
  try {
    const existing = await dualGetDoc<CharterRequestRecord>(['charter_requests', requestId]);
    if (!existing) return;
    await dualSetDoc(
      ['charter_requests', requestId],
      {
        ...existing,
        status: 'معتمد (شجرتي مفعّلة)',
      } as unknown as Record<string, unknown>
    );
  } catch {
    // Ignore
  }
}

export async function createSupportTicketInFirebase(
  ticket: Omit<SupportTicketRecord, 'id' | 'status' | 'timestamp'> & {
    status?: SupportTicketRecord['status'];
    timestamp?: string;
  }
): Promise<SupportTicketRecord> {
  const id = `sup_${Date.now()}`;
  const record: SupportTicketRecord = {
    clientName: ticket.clientName,
    email: ticket.email,
    category: ticket.category,
    subject: ticket.subject,
    message: ticket.message,
    status: ticket.status || 'مفتوح',
    timestamp: ticket.timestamp || new Date().toLocaleDateString('ar-SA'),
    id,
  };
  await dualSetDoc(
    ['support_tickets', id],
    record as unknown as Record<string, unknown>
  );
  return record;
}

export async function fetchSupportTicketsFromFirebase(): Promise<
  SupportTicketRecord[]
> {
  const list = await dualGetCollection<SupportTicketRecord>('support_tickets');
  return list.filter((t) => t.id !== 'sup_seed_01');
}

export async function resolveSupportTicketInFirebase(
  ticketId: string
): Promise<void> {
  try {
    const existing = await dualGetDoc<SupportTicketRecord>(['support_tickets', ticketId]);
    if (!existing) return;
    await dualSetDoc(
      ['support_tickets', ticketId],
      {
        ...existing,
        status: 'تم الحل',
      } as unknown as Record<string, unknown>
    );
  } catch {
    // Ignore
  }
}

