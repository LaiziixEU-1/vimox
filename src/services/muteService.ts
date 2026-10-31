import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../config/firebase";

// ───────────────────────── Notifications coupées pour un ami ─────────────────────────
// « mutes/<moi>_<ami> » : les notifications sont envoyées par le téléphone de l'AUTRE personne ; c'est donc
// elle qui doit pouvoir savoir qu'elle ne doit pas m'en envoyer. Les règles de sécurité n'autorisent la lecture
// qu'à moi et à cet ami (jamais aux autres), et l'écriture qu'à moi. L'application n'affiche rien à l'ami.

export type Mute = { messages: boolean; calls: boolean };

const pairId = (owner: string, friendId: string) => `${owner}_${friendId}`;

export async function getMute(owner: string, friendId: string): Promise<Mute> {
  const snap = await getDoc(doc(db, "mutes", pairId(owner, friendId)));
  const d = snap.data() as any;
  return { messages: d?.messages === true, calls: d?.calls === true };
}

// Sans aucune sourdine, le document est supprimé
export async function setMute(owner: string, friendId: string, next: Mute): Promise<void> {
  const ref = doc(db, "mutes", pairId(owner, friendId));
  if (!next.messages && !next.calls) {
    await deleteDoc(ref);
    return;
  }
  await setDoc(ref, {
    owner,
    muted: friendId,
    messages: next.messages,
    calls: next.calls,
    createdAt: serverTimestamp(),
  });
}

// Côté expéditeur : le destinataire m'a-t-il mis en sourdine ? (en cas d'erreur on notifie normalement)
export async function isMutedBy(recipientId: string, senderId: string, kind: keyof Mute): Promise<boolean> {
  try {
    return (await getMute(recipientId, senderId))[kind];
  } catch {
    return false;
  }
}
