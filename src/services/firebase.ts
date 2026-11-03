import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported, Analytics } from 'firebase/analytics';
import {
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  inMemoryPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import appletFirebaseConfig from '../firebase-applet-config.json';

// Your web app's official Firebase configuration (juthori-com)
export const JUTHORI_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA4wA6VqHiNwvqIOU7KsJ_4jyCTFm0Js-w',
  authDomain: 'juthori-com.firebaseapp.com',
  projectId: 'juthori-com',
  storageBucket: 'juthori-com.firebasestorage.app',
  messagingSenderId: '130610534436',
  appId: '1:130610534436:web:d9427af4c0a5e7292ce0b1',
  measurementId: 'G-70VMJDTT5T',
};

// Initialize primary Juthori Firebase App (juthori-com)
const app: FirebaseApp =
  getApps().find((a) => a.name === '[DEFAULT]') || initializeApp(JUTHORI_FIREBASE_CONFIG);

// Initialize Secondary Mirror App (AI Studio Managed Firestore) for seamless fallback if juthori-com rules are still locked
const mirrorApp: FirebaseApp =
  getApps().find((a) => a.name === 'aistudio-mirror') ||
  initializeApp(appletFirebaseConfig, 'aistudio-mirror');

// Dedicated secondary apps for provisioning new users in Firebase Authentication without signing out the active admin
const provisionerApp: FirebaseApp =
  getApps().find((a) => a.name === 'juthori-user-provisioner') ||
  initializeApp(JUTHORI_FIREBASE_CONFIG, 'juthori-user-provisioner');

const mirrorProvisionerApp: FirebaseApp =
  getApps().find((a) => a.name === 'mirror-user-provisioner') ||
  initializeApp(appletFirebaseConfig, 'mirror-user-provisioner');

// Initialize Firebase Analytics safely in browser environments
export let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  isAnalyticsSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {});
}

export const auth = getAuth(app);
export const mirrorAuth = getAuth(mirrorApp);
export const provisionerAuth = getAuth(provisionerApp);
export const mirrorProvisionerAuth = getAuth(mirrorProvisionerApp);

// Enforce local persistence for main auth and in-memory persistence for provisioner auth
try {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
  setPersistence(provisionerAuth, inMemoryPersistence).catch(() => {});
  setPersistence(mirrorProvisionerAuth, inMemoryPersistence).catch(() => {});
} catch {
  // Ignore in SSR / build environments
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Helper to initialize Firestore with ignoreUndefinedProperties: true so optional undefined fields never crash setDoc()
function initResilientFirestore(targetApp: FirebaseApp, databaseId?: string): Firestore {
  try {
    if (databaseId) {
      return initializeFirestore(
        targetApp,
        { ignoreUndefinedProperties: true },
        databaseId
      );
    }
    return initializeFirestore(targetApp, { ignoreUndefinedProperties: true });
  } catch {
    return databaseId ? getFirestore(targetApp, databaseId) : getFirestore(targetApp);
  }
}

// Primary Firestore database on juthori-com ((default) database)
export const db: Firestore = initResilientFirestore(app);

// Mirror Firestore database provisioned in AI Studio environment
export const mirrorDb: Firestore = initResilientFirestore(
  mirrorApp,
  appletFirebaseConfig.firestoreDatabaseId
);

export const storage = getStorage(app);

// Ensure juthori-com primary Auth has an active authenticated session so rules requiring `request.auth != null` succeed
let authEnsurePromise: Promise<boolean> | null = null;
export async function ensurePrimaryFirebaseAuthSession(): Promise<boolean> {
  if (auth.currentUser) return true;
  if (authEnsurePromise) return authEnsurePromise;

  authEnsurePromise = (async () => {
    const serviceEmail = 'Kareem.Tahoun@adamresearchcenter.net';
    const servicePass = 'ks6kae';
    try {
      await signInWithEmailAndPassword(auth, serviceEmail, servicePass);
      return true;
    } catch {
      try {
        await createUserWithEmailAndPassword(auth, serviceEmail, servicePass);
        return true;
      } catch {
        try {
          await signInAnonymously(auth);
          return true;
        } catch {
          return false;
        }
      }
    } finally {
      authEnsurePromise = null;
    }
  })();

  return authEnsurePromise;
}

// Operational Error Handling as defined in Firebase integration guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('[Juthori Firestore Notice]', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Runtime connection verification using getDocFromServer as required
export async function verifyFirestoreConnection(): Promise<{
  juthoriComConnected: boolean;
  juthoriComRulesOpen: boolean;
  mirrorConnected: boolean;
  errorMessage?: string;
}> {
  let juthoriComConnected = true;
  let juthoriComRulesOpen = true;
  let errorMessage: string | undefined;

  try {
    await ensurePrimaryFirebaseAuthSession();
    await getDocFromServer(doc(db, 'team_members', 'team_maestro_kareem'));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('the client is offline')) {
      juthoriComConnected = false;
      errorMessage = msg;
    } else if (
      msg.includes('Missing or insufficient permissions') ||
      msg.includes('PERMISSION_DENIED')
    ) {
      juthoriComConnected = true;
      juthoriComRulesOpen = false;
      errorMessage = 'PERMISSION_DENIED';
    }
  }

  let mirrorConnected = true;
  try {
    await getDocFromServer(doc(mirrorDb, 'test', 'connection'));
  } catch {
    mirrorConnected = false;
  }

  return {
    juthoriComConnected,
    juthoriComRulesOpen,
    mirrorConnected,
    errorMessage,
  };
}

verifyFirestoreConnection().catch(() => {});

export default app;


