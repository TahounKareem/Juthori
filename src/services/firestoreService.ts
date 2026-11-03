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
} from 'firebase/auth';
import {
  db,
  mirrorDb,
  auth,
  storage,
  handleFirestoreError,
  OperationType,
} from './firebase';

// Dual-database helpers: write to primary (juthori-com) AND mirrorDb; read from primary with fallback to mirrorDb
async function dualSetDoc(
  pathSegments: [string, ...string[]],
  data: Record<string, unknown>
): Promise<{ primaryWritten: boolean; mirrorWritten: boolean; primaryError?: string }> {
  let primaryWritten = false;
  let mirrorWritten = false;
  let primaryError: string | undefined;

  try {
    await setDoc(doc(db, ...pathSegments), data);
    primaryWritten = true;
  } catch (err) {
    primaryError = err instanceof Error ? err.message : String(err);
  }

  try {
    await setDoc(doc(mirrorDb, ...pathSegments), data);
    mirrorWritten = true;
  } catch {
    // Ignore mirror error
  }

  return { primaryWritten, mirrorWritten, primaryError };
}

async function dualGetDoc<T = Record<string, unknown>>(
  pathSegments: [string, ...string[]]
): Promise<T | null> {
  try {
    const snap = await getDoc(doc(db, ...pathSegments));
    if (snap.exists()) {
      return snap.data() as T;
    }
  } catch {
    // Fallback to mirrorDb below
  }

  try {
    const mirrorSnap = await getDoc(doc(mirrorDb, ...pathSegments));
    if (mirrorSnap.exists()) {
      const data = mirrorSnap.data() as T;
      // Opportunistically sync back to primary juthori-com if rules allow
      setDoc(doc(db, ...pathSegments), data as Record<string, unknown>).catch(() => {});
      return data;
    }
  } catch {
    // Ignore
  }

  return null;
}

async function dualDeleteDoc(pathSegments: [string, ...string[]]): Promise<void> {
  await Promise.allSettled([
    deleteDoc(doc(db, ...pathSegments)),
    deleteDoc(doc(mirrorDb, ...pathSegments)),
  ]);
}

async function dualGetCollection<T extends { id?: string }>(
  collectionName: string
): Promise<T[]> {
  const mergedMap = new Map<string, T>();

  try {
    const mirrorSnap = await getDocs(collection(mirrorDb, collectionName));
    mirrorSnap.docs.forEach((d) => {
      const item = d.data() as T;
      mergedMap.set(item.id || d.id, item);
    });
  } catch {
    // Ignore mirror read errors
  }

  try {
    const primarySnap = await getDocs(collection(db, collectionName));
    primarySnap.docs.forEach((d) => {
      const item = d.data() as T;
      mergedMap.set(item.id || d.id, item);
    });
  } catch {
    // If juthori-com rules are locked, mergedMap still returns mirrorDb records seamlessly
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

export interface KnowledgeArticleRecord {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  authorName: string;
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
  order: CustomerOrderRecord
): Promise<void> {
  const safeId = order.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    await dualSetDoc(
      ['customer_orders', safeId],
      {
        ...order,
        id: safeId,
      } as unknown as Record<string, unknown>
    );
  } catch (err) {
    console.warn('[upsertCustomerOrderInFirebase] warning:', err);
  }
}

export async function fetchAllCustomerOrdersFromFirebase(): Promise<CustomerOrderRecord[]> {
  const list = await dualGetCollection<CustomerOrderRecord>('customer_orders');
  return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
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
        .sort((a, b) => (b.openedAt || '').localeCompare(a.openedAt || ''));
    }
  } catch {
    // Fallback to dualGetCollection below
  }
  const all = await dualGetCollection<ResearchTicketData>('research_tickets');
  return all
    .filter((t) => t.userId === safeUid)
    .sort((a, b) => (b.openedAt || '').localeCompare(a.openedAt || ''));
}

export async function fetchAllResearchTicketsForStaff(): Promise<ResearchTicketData[]> {
  const all = await dualGetCollection<ResearchTicketData>('research_tickets');
  return all.sort((a, b) => (b.openedAt || '').localeCompare(a.openedAt || ''));
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
export const INITIAL_TEAM_MEMBERS_SEED: TeamMemberRecord[] = [
  FOUNDING_MAESTRO_MEMBER,
  {
    id: 'team_res_mansour',
    name: 'د. عبد العزيز المنصور',
    email: 'mansour@juthori.com',
    passwordHash: 'JthRes2026!',
    role: 'مدير البحوث',
    status: 'نشط',
    assignedTickets: 3,
    completedTickets: 48,
    avgCompletionTime: '18 ساعة',
    permissions: getPermissionsForTeamRole('مدير البحوث'),
    createdAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'team_ops_sara',
    name: 'أ. سارة العتيبي',
    email: 'sara.care@juthori.com',
    passwordHash: 'JthCare2026!',
    role: 'مدير إدارة الطلبات وخدمة العملاء',
    status: 'نشط',
    assignedTickets: 5,
    completedTickets: 112,
    avgCompletionTime: '4 ساعات',
    permissions: getPermissionsForTeamRole('مدير إدارة الطلبات وخدمة العملاء'),
    createdAt: '2026-02-01T09:00:00.000Z',
  },
  {
    id: 'team_cms_tariq',
    name: 'أ. طارق السعدون',
    email: 'tariq.cms@juthori.com',
    passwordHash: 'JthCms2026!',
    role: 'مدير تحرير المركز المعرفي',
    status: 'نشط',
    assignedTickets: 0,
    completedTickets: 29,
    avgCompletionTime: 'يومي',
    permissions: getPermissionsForTeamRole('مدير تحرير المركز المعرفي'),
    createdAt: '2026-02-10T12:00:00.000Z',
  },
];

export const INITIAL_KNOWLEDGE_ARTICLES_SEED: KnowledgeArticleRecord[] = [
  {
    id: 'art_methodology_01',
    title: 'منهجية التوثيق الجيني والتاريخي في شجرة آدم الموحدة',
    category: 'تحقيق المصادر',
    summary:
      'قواعد المطابقة الصارمة بين المشجرات الموروثة وأمهات كتب الأنساب المعتمدة لمنع تشابه الأسماء العشوائي.',
    content:
      'تعتمد منصة جذوري على منهجية التحقق الرباعي (4-Tier Universal Methodology) التي تربط سلاسل النسب الصاعدة نحو آدم عليه السلام عبر التقاطع الهيكلي للقبيلة والفرع والموطن الجغرافي الأصلي، مع الفحص المتوازي في أمهات الكتب والمخطوطات (مشاريع ألفا) لتوثيق كل عقدة برقم الصفحة والمصدر.',
    authorName: 'كريم طاحون — مركز آدم للبحوث',
    status: 'published',
    createdAt: '2026-01-10T08:00:00.000Z',
  },
  {
    id: 'art_arab_migrations_02',
    title: 'مسارات هجرات القبائل العدنانية والقحطانية عبر الجزيرة العربية والشام ووادي النيل',
    category: 'تاريخ القبائل والهجرات',
    summary:
      'قراءة جغرافية تاريخية في مواطن الاستقرار والتحالفات القبلية الكبرى وأثرها في حفظ سلاسل النسب.',
    content:
      'شهدت الجزيرة العربية على مر العصور حواضر علمية وقبلية حفظت أنساب الأسر والبطون في دفاتر الوقف والمشجرات العائلية. يستعرض هذا البحث كيف تتبع باحثو جذوري امتداد الفروع العائلية بين الحجاز ونجد واليمن والشام والعراق ومصر والمغرب العربي.',
    authorName: 'د. عبد العزيز المنصور',
    status: 'published',
    createdAt: '2026-02-05T11:30:00.000Z',
  },
];

export async function ensureFoundingMaestroInFirebase(): Promise<TeamMemberRecord> {
  try {
    // Also ensure Founding Maestro exists as a user profile in /users
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

    await dualSetDoc(
      ['team_members', FOUNDING_MAESTRO_MEMBER.id],
      FOUNDING_MAESTRO_MEMBER as unknown as Record<string, unknown>
    );
    await dualSetDoc(
      ['users', maestroUserProfile.userId],
      maestroUserProfile as unknown as Record<string, unknown>
    );

    const existing = await dualGetDoc<TeamMemberRecord>([
      'team_members',
      FOUNDING_MAESTRO_MEMBER.id,
    ]);
    return existing || FOUNDING_MAESTRO_MEMBER;
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
  const collectionsSeeded: string[] = [];

  // 1. Ensure Maestro Firebase Auth session on juthori-com if no user is currently signed in
  try {
    if (!auth.currentUser) {
      await signInWithEmailAndPassword(
        auth,
        FOUNDING_MAESTRO_MEMBER.email,
        FOUNDING_MAESTRO_MEMBER.passwordHash
      ).catch(async () => {
        const cred = await createUserWithEmailAndPassword(
          auth,
          FOUNDING_MAESTRO_MEMBER.email,
          FOUNDING_MAESTRO_MEMBER.passwordHash
        );
        await updateProfile(cred.user, { displayName: 'كريم طاحون (المايسترو)' });
      });
    }
  } catch {
    // Non-blocking if Auth is already active or offline
  }

  // 2. Seed Founding Maestro & Team Members (/team_members)
  const maestroWrite = await dualSetDoc(
    ['team_members', FOUNDING_MAESTRO_MEMBER.id],
    FOUNDING_MAESTRO_MEMBER as unknown as Record<string, unknown>
  );
  for (const staff of INITIAL_TEAM_MEMBERS_SEED) {
    if (staff.id !== FOUNDING_MAESTRO_MEMBER.id) {
      const existingStaff = await dualGetDoc<TeamMemberRecord>(['team_members', staff.id]);
      if (!existingStaff) {
        await dualSetDoc(
          ['team_members', staff.id],
          staff as unknown as Record<string, unknown>
        );
      }
    }
  }
  collectionsSeeded.push('team_members');

  // 3. Seed Maestro User Profile (/users)
  await ensureFoundingMaestroInFirebase();
  collectionsSeeded.push('users');

  // 4. Seed Knowledge Articles (/knowledge_articles) if empty
  const existingArticles = await dualGetCollection<KnowledgeArticleRecord>('knowledge_articles');
  if (existingArticles.length === 0) {
    for (const article of INITIAL_KNOWLEDGE_ARTICLES_SEED) {
      await dualSetDoc(
        ['knowledge_articles', article.id],
        article as unknown as Record<string, unknown>
      );
    }
  }
  collectionsSeeded.push('knowledge_articles');

  // 5. Seed Initial Customer Order (/customer_orders) if empty
  const existingOrders = await dualGetCollection<CustomerOrderRecord>('customer_orders');
  if (existingOrders.length === 0) {
    const initialOrder: CustomerOrderRecord = {
      id: 'ord_seed_almuqit_01',
      userId: 'usr_seed_hassan',
      fullName: 'حسن بن عبد الله آل مقيت',
      firstName: 'حسن',
      fatherName: 'عبد الله',
      grandfatherName: 'سعيد',
      familyName: 'آل مقيت',
      originCountry: 'السعودية',
      originRegion: 'عسير — سراة عبيدة',
      email: 'hassan.almuqit@juthori.com',
      phone: '+966551234567',
      legalRole: 'record_keeper',
      accountStatus: 'annual_vip',
      walletBalanceUsd: 25,
      paidRevenueUsd: 60,
      matchStatus: 'auto_adam_full',
      ticketId: 'JTH-1042',
      ticketType: 'إثراء شجرة آدم P2',
      assignedResearcher: 'د. عبد العزيز المنصور',
      slaStatus: 'قيد العمل',
      nodesCountLabel: '14 محطة مكوّدة (شجرة آدم)',
      createdAt: '2026-02-20T14:00:00.000Z',
    };
    await dualSetDoc(
      ['customer_orders', initialOrder.id],
      initialOrder as unknown as Record<string, unknown>
    );
  }
  collectionsSeeded.push('customer_orders');

  // 6. Seed Initial Research Ticket (/research_tickets) if empty
  const existingTickets = await dualGetCollection<ResearchTicketData>('research_tickets');
  if (existingTickets.length === 0) {
    const initialTicket: ResearchTicketData = {
      id: 'ticket_seed_1042',
      ticketNumber: 'JTH-1042',
      userId: 'usr_seed_hassan',
      userFullName: 'حسن بن عبد الله آل مقيت',
      userEmail: 'hassan.almuqit@juthori.com',
      userPhone: '+966551234567',
      targetAncestor: 'آل مقيت — بني بشر — قحطان',
      tribeName: 'بني بشر',
      familyBranch: 'آل برمان',
      originCountry: 'السعودية',
      additionalNotes: 'تذكرة إثراء تلقائية من مشاريع ألفا لتوثيق الفروع الشقيقة والمواضع الجغرافية',
      ticketCategory: 'ADAM_NODE_ENRICHMENT',
      status: 'pending_review',
      assignedResearcherName: 'د. عبد العزيز المنصور',
      openedAt: '2026-02-20T14:05:00.000Z',
    };
    await dualSetDoc(
      ['research_tickets', initialTicket.id],
      initialTicket as unknown as Record<string, unknown>
    );
  }
  collectionsSeeded.push('research_tickets');

  // 7. Seed Initial Charter Request (/charter_requests) if empty
  const existingCharters = await dualGetCollection<CharterRequestRecord>('charter_requests');
  if (existingCharters.length === 0) {
    const initialCharter: CharterRequestRecord = {
      id: 'chr_seed_01',
      userId: 'usr_seed_hassan',
      clientName: 'حسن بن عبد الله آل مقيت',
      familyName: 'آل مقيت',
      email: 'hassan.almuqit@juthori.com',
      country: 'السعودية',
      submittedAt: '2026-02-20',
      charterCode: 'JTH-CHR-8841',
      status: 'معتمد (شجرتي مفعّلة)',
    };
    await dualSetDoc(
      ['charter_requests', initialCharter.id],
      initialCharter as unknown as Record<string, unknown>
    );
  }
  collectionsSeeded.push('charter_requests');

  // 8. Seed Initial Support Ticket (/support_tickets) if empty
  const existingSupport = await dualGetCollection<SupportTicketRecord>('support_tickets');
  if (existingSupport.length === 0) {
    const initialSupport: SupportTicketRecord = {
      id: 'sup_seed_01',
      clientName: 'خالد القاسمي',
      email: 'khalid.alqasimi@juthori.com',
      category: 'استفسار نسبي',
      subject: 'إضافة وثيقة وقف عائلية قديمة إلى ملف الأسرة',
      message: 'نرغب في إرفاق صورة مخطوطة الوقف العائلي المؤرخة عام 1295هـ لمراجعتها من الباحث المختص.',
      status: 'مفتوح',
      timestamp: '2026-02-25',
    };
    await dualSetDoc(
      ['support_tickets', initialSupport.id],
      initialSupport as unknown as Record<string, unknown>
    );
  }
  collectionsSeeded.push('support_tickets');

  return {
    juthoriComSynced: maestroWrite.primaryWritten,
    mirrorSynced: maestroWrite.mirrorWritten,
    collectionsSeeded,
    juthoriComError: maestroWrite.primaryError,
  };
}

export async function fetchAllTeamMembersFromFirebase(): Promise<TeamMemberRecord[]> {
  await ensureFoundingMaestroInFirebase();
  const list = await dualGetCollection<TeamMemberRecord>('team_members');
  if (list.length === 0) {
    return INITIAL_TEAM_MEMBERS_SEED;
  }
  // Ensure Founding Maestro is always first in list
  const hasMaestro = list.some(
    (m) => m.email.toLowerCase() === FOUNDING_MAESTRO_MEMBER.email.toLowerCase()
  );
  if (!hasMaestro) {
    return [FOUNDING_MAESTRO_MEMBER, ...list];
  }
  return list;
}

export async function authenticateTeamMemberInFirebase(
  email: string,
  password: string
): Promise<{ member: TeamMemberRecord | null; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = password.trim();

  // Attempt real Firebase Auth sign-in on juthori-com so request.auth is active
  try {
    await signInWithEmailAndPassword(auth, email.trim(), cleanPass);
  } catch {
    if (
      cleanEmail === FOUNDING_MAESTRO_MEMBER.email.toLowerCase() &&
      cleanPass === FOUNDING_MAESTRO_MEMBER.passwordHash
    ) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, FOUNDING_MAESTRO_MEMBER.email, cleanPass);
        await updateProfile(cred.user, { displayName: 'كريم طاحون (المايسترو)' });
      } catch {
        // Ignore if already exists
      }
    }
  }

  await ensureFoundingMaestroInFirebase();

  // Check Founding Maestro directly first
  if (
    cleanEmail === FOUNDING_MAESTRO_MEMBER.email.toLowerCase() &&
    cleanPass === FOUNDING_MAESTRO_MEMBER.passwordHash
  ) {
    return { member: FOUNDING_MAESTRO_MEMBER };
  }

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
}): Promise<{ member: TeamMemberRecord; emailDispatched: boolean }> {
  const id = `team_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newMember: TeamMemberRecord = {
    id,
    name: params.name.trim(),
    email: params.email.trim(),
    passwordHash: params.passwordHash.trim() || 'JthTeam2026!',
    role: params.role,
    status: 'نشط',
    assignedTickets: 0,
    completedTickets: 0,
    avgCompletionTime: 'جديد',
    permissions: getPermissionsForTeamRole(params.role),
    createdAt: new Date().toISOString(),
  };

  await dualSetDoc(
    ['team_members', id],
    newMember as unknown as Record<string, unknown>
  );

  // Send official invitation via Resend API (info@Juthori.com)
  let emailDispatched = false;
  try {
    const res = await fetch('/api/juthori/team/send-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newMember.email,
        name: newMember.name,
        role: newMember.role,
        tempPassword: newMember.passwordHash,
        invitedBy: params.invitedByName || 'كريم طاحون (المايسترو)',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      emailDispatched = Boolean(data.dispatched);
    }
  } catch {
    // Non-blocking
  }

  return { member: newMember, emailDispatched };
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

// =============================================================================
// 8. KNOWLEDGE CENTER CMS IN FIREBASE (/knowledge_articles)
// =============================================================================
export async function fetchKnowledgeArticlesFromFirebase(
  publishedOnly: boolean = false
): Promise<KnowledgeArticleRecord[]> {
  const list = await dualGetCollection<KnowledgeArticleRecord>('knowledge_articles');
  const sorted = (list.length > 0 ? list : INITIAL_KNOWLEDGE_ARTICLES_SEED).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
  return publishedOnly ? sorted.filter((a) => a.status === 'published') : sorted;
}

export async function saveKnowledgeArticleToFirebase(
  article: Omit<KnowledgeArticleRecord, 'id' | 'createdAt'> & {
    id?: string;
    createdAt?: string;
  }
): Promise<KnowledgeArticleRecord> {
  const id = (
    article.id || `art_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  ).replace(/[^a-zA-Z0-9_-]/g, '_');

  const record: KnowledgeArticleRecord = {
    id,
    title: article.title.trim(),
    category: article.category.trim() || 'تحقيق المصادر',
    summary: article.summary.trim(),
    content: article.content.trim(),
    authorName: article.authorName.trim() || 'هيئة تحرير المركز المعرفي',
    status: article.status || 'published',
    createdAt: article.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await dualSetDoc(
    ['knowledge_articles', id],
    record as unknown as Record<string, unknown>
  );
  return record;
}

export async function deleteKnowledgeArticleFromFirebase(
  articleId: string
): Promise<void> {
  const safeId = articleId.replace(/[^a-zA-Z0-9_-]/g, '_');
  await dualDeleteDoc(['knowledge_articles', safeId]);
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
  return dualGetCollection<CharterRequestRecord>('charter_requests');
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
  return dualGetCollection<SupportTicketRecord>('support_tickets');
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

