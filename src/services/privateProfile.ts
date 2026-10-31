import {
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";

// ───────────────────────── Âge privé ─────────────────────────
// L'âge n'est plus dans le profil public (lisible par toute personne connectée) :
// il vit dans « users/<uid>/private/info », lisible UNIQUEMENT par la personne elle-même.
// Les autres ne le voient qu'en match : il est alors copié dans la conversation (« ages »),
// que seules les deux personnes de la conversation peuvent lire.
// Les règles Firestore lisent cet âge privé pour imposer la séparation mineurs / adultes.

export const privateRef = (uid: string) => doc(db, "users", uid, "private", "info");

export type PrivateInfo = { age: number | null };

// Suit mon âge privé (null tant qu'il n'existe pas encore)
export function subscribePrivateInfo(
  uid: string,
  onUpdate: (info: PrivateInfo, exists: boolean) => void,
): () => void {
  return onSnapshot(
    privateRef(uid),
    (snap) => {
      const age = snap.data()?.age;
      onUpdate({ age: typeof age === "number" ? age : null }, snap.exists());
    },
    () => onUpdate({ age: null }, false),
  );
}

// Anciens comptes : l'âge public est déplacé dans l'espace privé.
// IMPORTANT : en DEUX étapes, dans cet ordre. L'âge public n'est retiré qu'APRÈS que le serveur a
// confirmé l'âge privé. Si les règles Firebase refusent (pas encore publiées), rien ne change sur
// le téléphone : pas de clignotement, et l'âge public reste en place.
export async function migrateAgeIfNeeded(uid: string, publicAge: unknown): Promise<boolean> {
  if (typeof publicAge !== "number") return false;
  const snap = await getDoc(privateRef(uid)); // refusé = règles pas publiées : on s'arrête là
  if (!snap.exists()) {
    await setDoc(privateRef(uid), { age: publicAge, createdAt: serverTimestamp() });
  }
  await updateDoc(doc(db, "users", uid), { age: deleteField() });
  return true;
}
