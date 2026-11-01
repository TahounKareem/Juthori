import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';

export interface UserProfileData {
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  accountType: 'individual' | 'record_keeper';
  originCountry?: string;
  tribeName?: string;
  familyBranch?: string;
  subscriptionTier: 'free' | 'basic_verified' | 'premium_annual';
  walletBalance: number;
  isRootUnlocked?: boolean;
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
  status: 'pending_review' | 'investigating' | 'lineage_found' | 'completed' | 'no_records_found';
  assignedResearcherId?: string;
  assignedResearcherName?: string;
  researchFindings?: string;
  verifiedSources?: string;
  clientNotified?: boolean;
  openedAt: string;
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

// =============================================================================
// 1. USER PROFILE MANAGEMENT
// =============================================================================
export async function fetchUserProfile(userId: string): Promise<UserProfileData | null> {
  if (!auth.currentUser) return null;
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as UserProfileData;
  } catch (error) {
    console.warn('[fetchUserProfile] Firestore fetch notice:', error);
    return null;
  }
}

export async function createUserProfileIfMissing(
  user: { uid: string; email?: string | null; displayName?: string | null },
  additional: Partial<UserProfileData> = {}
): Promise<UserProfileData> {
  const initialProfile: UserProfileData = {
    userId: user.uid,
    fullName: additional.fullName || user.displayName || 'مستخدم جذوري',
    email: user.email || 'user@juthori.com',
    phone: additional.phone || '',
    accountType: additional.accountType || 'individual',
    originCountry: additional.originCountry || 'SA',
    tribeName: additional.tribeName || '',
    familyBranch: additional.familyBranch || '',
    subscriptionTier: 'free',
    walletBalance: 0,
    isRootUnlocked: false,
    createdAt: new Date().toISOString(),
  };

  if (!auth.currentUser) {
    return initialProfile;
  }

  try {
    const existing = await fetchUserProfile(user.uid);
    if (existing) return existing;

    await setDoc(doc(db, 'users', user.uid), initialProfile);

    // Dispatch welcome notification from Customer Care
    try {
      await sendCustomerNotification({
        userId: user.uid,
        title: 'مرحباً بك في مجتمع جذوري العربي للأنساب',
        body: 'يسعدنا انضمامك! يمكنك الآن فحص عمود نسبك، توثيق مشجرة العائلة، وحفظ وثائقك التاريخية في خزانتي.',
        category: 'system_notice',
        actionUrl: 'lineage',
        actionLabel: 'استكشف عمود نسبك',
        senderRole: 'support',
      });
    } catch {
      // Non-blocking notification
    }

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
  if (!auth.currentUser) return;
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, 'users', userId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// =============================================================================
// 2. RESEARCH TICKETS WORKFLOW (عند عدم التطابق / الحالة 3)
// =============================================================================
export async function createResearchTicket(
  params: Omit<ResearchTicketData, 'id' | 'ticketNumber' | 'status' | 'openedAt'>
): Promise<ResearchTicketData> {
  const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const ticketNumber = `JTH-${Math.floor(1000 + Math.random() * 9000)}`;
  const path = `research_tickets/${ticketId}`;

  const ticket: ResearchTicketData = {
    ...params,
    id: ticketId,
    ticketNumber,
    status: 'pending_review',
    openedAt: new Date().toISOString(),
  };

  if (!auth.currentUser) {
    return ticket;
  }

  try {
    await setDoc(doc(db, 'research_tickets', ticketId), ticket);

    // Also notify the user through the customer support notifications subcollection
    await sendCustomerNotification({
      userId: params.userId,
      title: `تم فتح تذكرة بحث أنساب برقم #${ticketNumber}`,
      body: `تم إحالة عمود نسب عائلة "${params.targetAncestor}" إلى فريق الباحثين الجينيالوجيين للمراجعة في السجلات الأرشيفية والمخطوطات المعتمدة. سنوافيك بالتفاصيل فور استخراج النتائج.`,
      category: 'ticket_update',
      actionUrl: 'tickets',
      actionLabel: 'متابعة حالة التذكرة',
      senderRole: 'researcher',
    });

    return ticket;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchUserResearchTickets(userId: string): Promise<ResearchTicketData[]> {
  if (!auth.currentUser) return [];
  try {
    const q = query(
      collection(db, 'research_tickets'),
      where('userId', '==', userId),
      orderBy('openedAt', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as ResearchTicketData);
  } catch {
    try {
      const qSimple = query(collection(db, 'research_tickets'), where('userId', '==', userId));
      const snap = await getDocs(qSimple);
      return snap.docs.map((d) => d.data() as ResearchTicketData);
    } catch {
      return [];
    }
  }
}

export async function fetchAllResearchTicketsForStaff(): Promise<ResearchTicketData[]> {
  if (!auth.currentUser) return [];
  try {
    const q = query(collection(db, 'research_tickets'), orderBy('openedAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as ResearchTicketData);
  } catch {
    try {
      const snap = await getDocs(collection(db, 'research_tickets'));
      return snap.docs.map((d) => d.data() as ResearchTicketData);
    } catch {
      return [];
    }
  }
}

export async function resolveResearchTicketByStaff(
  ticketId: string,
  researcherId: string,
  researcherName: string,
  findings: string,
  verifiedSources: string,
  newStatus: 'lineage_found' | 'completed' | 'no_records_found'
): Promise<void> {
  if (!auth.currentUser) return;
  const path = `research_tickets/${ticketId}`;
  try {
    const docRef = doc(db, 'research_tickets', ticketId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const ticket = snap.data() as ResearchTicketData;

    await updateDoc(docRef, {
      status: newStatus,
      assignedResearcherId: researcherId,
      assignedResearcherName: researcherName,
      researchFindings: findings,
      verifiedSources: verifiedSources,
      clientNotified: true,
      resolvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Notify the client about completion
    await sendCustomerNotification({
      userId: ticket.userId,
      title: `نتائج البحث الأرشيفي لتذكرة #${ticket.ticketNumber}`,
      body:
        newStatus === 'lineage_found' || newStatus === 'completed'
          ? `أنهى الباحث الجينيالوجي (${researcherName}) التحقيق الأرشيفي لعمود نسب "${ticket.targetAncestor}" وتم توثيق النتائج بنجاح! راجع لوحة التحكم لاستعراض النتائج والمصادر.`
          : `أنهى الباحث دراسة تذكرة #${ticket.ticketNumber}، ولم يتم العثور على مصادر كافية حالياً، وجاري البحث في أرشيفات أوسع.`,
      category: 'ticket_update',
      actionUrl: 'lineage',
      actionLabel: 'استعراض عمود النسب المحقق',
      senderRole: 'researcher',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// =============================================================================
// 3. WALLET & ANNUAL SUBSCRIPTION MODEL ($60/yr + Wallet Balance Bonus)
// =============================================================================
export async function executeWalletTransaction(
  userId: string,
  type: 'credit' | 'debit',
  amount: number,
  reason: string,
  referenceId?: string
): Promise<{ newBalance: number }> {
  if (!auth.currentUser) {
    return { newBalance: type === 'credit' ? amount : 0 };
  }
  const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const txPath = `users/${userId}/wallet_transactions/${txId}`;

  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const currentBalance = userSnap.exists() ? (userSnap.data().walletBalance ?? 0) : 0;

    let newBalance = currentBalance;
    if (type === 'credit') {
      newBalance = currentBalance + amount;
    } else {
      if (currentBalance < amount) {
        throw new Error('رصيد المحفظة غير كافٍ لإتمام هذه المعاملة.');
      }
      newBalance = currentBalance - amount;
    }

    // Update user balance
    await updateDoc(userRef, {
      walletBalance: newBalance,
      updatedAt: new Date().toISOString(),
    });

    // Record ledger transaction
    const txRecord: WalletTransactionData = {
      id: txId,
      userId,
      type,
      amount,
      reason,
      referenceId: referenceId || 'manual',
      balanceAfter: newBalance,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'users', userId, 'wallet_transactions', txId), txRecord);

    return { newBalance };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, txPath);
  }
}

export async function processAnnualSubscriptionUpgrade(
  userId: string,
  planPriceUsd: number = 60,
  bonusWalletCreditsUsd: number = 25
): Promise<{ success: boolean; newBalance: number }> {
  if (!auth.currentUser) {
    return { success: true, newBalance: bonusWalletCreditsUsd };
  }
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const currentBalance = userSnap.exists() ? (userSnap.data().walletBalance ?? 0) : 0;
    const newBalance = currentBalance + bonusWalletCreditsUsd;

    // Upgrade user tier to premium_annual & add bonus balance
    await updateDoc(userRef, {
      subscriptionTier: 'premium_annual',
      isRootUnlocked: true,
      walletBalance: newBalance,
      updatedAt: new Date().toISOString(),
    });

    // Record the credit transaction
    await executeWalletTransaction(
      userId,
      'credit',
      bonusWalletCreditsUsd,
      `رصيد محفظة ترحيبي مع الاشتراك السنوي بريميوم ($${planPriceUsd}/سنة)`,
      'annual_subscription_bonus'
    );

    // Send customer care celebration notification
    await sendCustomerNotification({
      userId,
      title: 'تهانينا! تم تفعيل الاشتراك السنوي بريميوم بنجاح',
      body: `تم فتح عمود النسب الكامل وكافة أدوات الإرث (شجرتي، خزانتي، كشافي، موقعي، مجتمعي)، كما تم إيداع رصيد هدية بقيمة $${bonusWalletCreditsUsd} في محفظتك الرقمية لاستخدامه في الخدمات الممتازة!`,
      category: 'wallet_bonus',
      actionUrl: 'wallet',
      actionLabel: 'استعراض المحفظة',
      senderRole: 'support',
    });

    return { success: true, newBalance };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchUserWalletTransactions(userId: string): Promise<WalletTransactionData[]> {
  if (!auth.currentUser) return [];
  try {
    const q = query(
      collection(db, 'users', userId, 'wallet_transactions'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as WalletTransactionData);
  } catch {
    try {
      const snap = await getDocs(collection(db, 'users', userId, 'wallet_transactions'));
      return snap.docs.map((d) => d.data() as WalletTransactionData);
    } catch {
      return [];
    }
  }
}

// =============================================================================
// 4. CUSTOMER CARE NOTIFICATIONS & PROACTIVE MESSAGING
// =============================================================================
export async function sendCustomerNotification(
  params: Omit<CustomerNotificationData, 'id' | 'isRead' | 'createdAt'>
): Promise<CustomerNotificationData> {
  const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const path = `users/${params.userId}/notifications/${notifId}`;

  const notif: CustomerNotificationData = {
    ...params,
    id: notifId,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  if (!auth.currentUser) {
    return notif;
  }

  try {
    await setDoc(doc(db, 'users', params.userId, 'notifications', notifId), notif);
    return notif;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchUserNotifications(userId: string): Promise<CustomerNotificationData[]> {
  if (!auth.currentUser) return [];
  try {
    const q = query(
      collection(db, 'users', userId, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(25)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as CustomerNotificationData);
  } catch {
    try {
      const snap = await getDocs(collection(db, 'users', userId, 'notifications'));
      return snap.docs.map((d) => d.data() as CustomerNotificationData);
    } catch {
      return [];
    }
  }
}

export async function markNotificationAsRead(userId: string, notifId: string): Promise<void> {
  if (!auth.currentUser) return;
  const path = `users/${userId}/notifications/${notifId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'notifications', notifId), {
      isRead: true,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Check admin/staff status
export async function checkStaffStatus(uid: string): Promise<{ isAdmin: boolean; isResearcher: boolean; isSupport: boolean }> {
  try {
    const adminSnap = await getDoc(doc(db, 'admins', uid));
    if (adminSnap.exists()) {
      return { isAdmin: true, isResearcher: true, isSupport: true };
    }
    const staffSnap = await getDoc(doc(db, 'staff', uid));
    if (staffSnap.exists()) {
      const role = staffSnap.data()?.role;
      return {
        isAdmin: role === 'admin',
        isResearcher: role === 'admin' || role === 'researcher',
        isSupport: role === 'admin' || role === 'support',
      };
    }
    return { isAdmin: false, isResearcher: false, isSupport: false };
  } catch {
    return { isAdmin: false, isResearcher: false, isSupport: false };
  }
}
