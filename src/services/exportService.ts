/*VIMOX-V17*/
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../config/firebase";
import { getChatId } from "./snapService";
import { getCurrentUser } from "./authState";

// « Télécharger mes données » : copie de ce que VimoX conserve sur toi (droit d'accès / portabilité).
// Chaque rubrique est lue séparément : si l'une est indisponible, les autres sont quand même fournies.

const MAX_ROOMS = 300;
const MAX_MESSAGES = 5000;

const plain = (v: any): any => {
  if (v === null || v === undefined) return null;
  if (typeof v?.toMillis === "function") return new Date(v.toMillis()).toISOString();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(plain);
  if (typeof v === "object") {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  }
  return v;
};
const clean = (d: any) => plain(d);

async function section(fn: () => Promise<any>): Promise<{ donnees: any; erreur?: string }> {
  try {
    return { donnees: await fn() };
  } catch (e: any) {
    return { donnees: null, erreur: String(e?.code ?? e?.message ?? "indisponible").slice(0, 80) };
  }
}

export async function buildDataExport(
  userId: string,
): Promise<{ text: string; resume: Record<string, number | string> }> {
  const email = getCurrentUser()?.email ?? "";
  const out: Record<string, any> = {};

  out.profil = await section(async () => {
    const snap = await getDoc(doc(db, "users", userId));
    const { pushToken: _t, ...data } = (snap.data() ?? {}) as any;
    const priv = await getDoc(doc(db, "users", userId, "private", "info")).catch(() => null);
    const age = (priv?.data() as any)?.age ?? data.age ?? null;
    return { email, ...clean(data), age };
  });

  out.amis = await section(async () => {
    const snap = await getDocs(query(collection(db, "friends"), where("userId", "==", userId)));
    return snap.docs.map((d) => clean(d.data()));
  });

  out.demandesEnvoyees = await section(async () => {
    const snap = await getDocs(query(collection(db, "friendRequests"), where("fromUid", "==", userId)));
    return snap.docs.map((d) => clean(d.data()));
  });
  out.demandesRecues = await section(async () => {
    const snap = await getDocs(query(collection(db, "friendRequests"), where("toUid", "==", userId)));
    return snap.docs.map((d) => clean(d.data()));
  });

  out.mesStories = await section(async () => {
    const snap = await getDocs(query(collection(db, "stories"), where("userId", "==", userId)));
    return snap.docs.map((d) => clean(d.data()));
  });
  out.souvenirs = await section(async () => {
    const snap = await getDocs(query(collection(db, "memories"), where("userId", "==", userId)));
    return snap.docs.map((d) => clean(d.data()));
  });
  out.autocollants = await section(async () => {
    const snap = await getDocs(query(collection(db, "customStickers"), where("userId", "==", userId)));
    return snap.docs.map((d) => clean(d.data()));
  });

  // Messages que j'ai ENVOYÉS (ceux des autres personnes leur appartiennent)
  let budget = MAX_MESSAGES;
  out.messagesDesMatchs = await section(async () => {
    const rooms = await getDocs(
      query(collection(db, "rooms"), where("participants", "array-contains", userId)),
    );
    const result: any[] = [];
    for (const r of rooms.docs.slice(0, MAX_ROOMS)) {
      if (budget <= 0) break;
      const snap = await getDocs(
        query(collection(db, "rooms", r.id, "messages"), where("senderId", "==", userId)),
      );
      const msgs = snap.docs.slice(0, budget).map((d) => clean(d.data()));
      budget -= msgs.length;
      if (msgs.length) result.push({ conversation: r.id, messages: msgs });
    }
    return result;
  });

  out.messagesAvecMesAmis = await section(async () => {
    const friends = await getDocs(query(collection(db, "friends"), where("userId", "==", userId)));
    const ids = [...new Set(friends.docs.map((d) => d.data().id).filter(Boolean))] as string[];
    const result: any[] = [];
    for (const fid of ids) {
      if (budget <= 0) break;
      const snap = await getDocs(
        query(collection(db, "friendChats", getChatId(userId, fid), "messages"), where("senderUid", "==", userId)),
      );
      const msgs = snap.docs.slice(0, budget).map((d) => clean(d.data()));
      budget -= msgs.length;
      if (msgs.length) result.push({ ami: fid, messages: msgs });
    }
    return result;
  });

  const count = (s: any) => (Array.isArray(s?.donnees) ? s.donnees.length : 0);
  const nbMessages = (s: any) =>
    Array.isArray(s?.donnees) ? s.donnees.reduce((n: number, c: any) => n + c.messages.length, 0) : 0;
  const resume = {
    amis: count(out.amis),
    stories: count(out.mesStories),
    souvenirs: count(out.souvenirs),
    messagesEnvoyes: nbMessages(out.messagesDesMatchs) + nbMessages(out.messagesAvecMesAmis),
  };

  const full = {
    application: "VimoX",
    exporteLe: new Date().toISOString(),
    identifiant: userId,
    remarques: [
      "Ce fichier contient les données que VimoX conserve sur toi.",
      "Seuls TES messages envoyés sont inclus : ceux des autres personnes leur appartiennent.",
      "Les signalements que tu as envoyés ne sont pas consultables dans l'application : écris à l'adresse de contact pour y accéder.",
      "Une rubrique marquée « erreur » n'a pas pu être lue : réessaie plus tard.",
    ],
    ...out,
  };
  return { text: JSON.stringify(full, null, 2), resume };
}
