import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import {
  getAuth,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  type User,
} from "firebase/auth";
import type { Question, Questionnaire, Reponse, Recherche } from "./types";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ─── Auth ───

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

function genererCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createQuestionnaire(data: {
  titre: string;
  theme: string;
  consignes: string;
  questions: Question[];
}): Promise<{ id: string; codeAcces: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Non authentifié");
  const codeAcces = genererCode();
  const docRef = await addDoc(collection(db, "questionnaires"), {
    ...data,
    codeAcces,
    profId: user.uid,
    creeLe: serverTimestamp(),
  });
  return { id: docRef.id, codeAcces };
}

export async function getQuestionnaires(): Promise<Questionnaire[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const q = query(
    collection(db, "questionnaires"),
    where("profId", "==", user.uid),
    orderBy("creeLe", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Questionnaire));
}

export async function getQuestionnaire(id: string): Promise<Questionnaire | null> {
  const d = await getDoc(doc(db, "questionnaires", id));
  if (!d.exists()) return null;
  return { id: d.id, ...d.data() } as Questionnaire;
}

export async function deleteQuestionnaire(id: string): Promise<void> {
  await deleteDoc(doc(db, "questionnaires", id));
}

export async function updateQuestionnaire(id: string, data: {
  titre: string;
  theme: string;
  consignes: string;
  questions: Question[];
}): Promise<void> {
  await updateDoc(doc(db, "questionnaires", id), data);
}

export async function archiverQuestionnaire(id: string, archive: boolean): Promise<void> {
  await updateDoc(doc(db, "questionnaires", id), { archive });
}

export async function getReponses(questionnaireId: string): Promise<Reponse[]> {
  const q = query(
    collection(db, "questionnaires", questionnaireId, "reponses"),
    orderBy("soumisLe", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reponse));
}

export async function getRecherchesParQuestionnaire(
  questionnaireId: string
): Promise<Recherche[]> {
  const q = query(
    collection(db, "recherches"),
    where("questionnaireId", "==", questionnaireId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Recherche));
}
