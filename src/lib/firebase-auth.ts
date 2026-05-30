import { initializeApp } from "firebase/app"
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User,
  type UserCredential,
} from "firebase/auth"

const requiredFirebaseEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

let cachedAuth: ReturnType<typeof getAuth> | null = null

const getFirebaseAuth = () => {
  if (cachedAuth) {
    return cachedAuth
  }

  const missing = Object.entries(requiredFirebaseEnv)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    throw new Error(`Faltan variables de Firebase en .env: ${missing.join(", ")}`)
  }

  const app = initializeApp(requiredFirebaseEnv)
  cachedAuth = getAuth(app)
  return cachedAuth
}

export const loginWithEmailPassword = async (email: string, password: string): Promise<UserCredential> => {
  const auth = getFirebaseAuth()
  return signInWithEmailAndPassword(auth, email, password)
}

export const loginWithGooglePopup = async () => {
  const auth = getFirebaseAuth()
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  const idToken = await result.user.getIdToken()
  return { idToken, user: result.user }
}

export const subscribeToAuthState = (callback: (user: User | null) => void) => {
  const auth = getFirebaseAuth()
  return onAuthStateChanged(auth, callback)
}

export const logoutUser = async () => {
  const auth = getFirebaseAuth()
  await signOut(auth)
}
