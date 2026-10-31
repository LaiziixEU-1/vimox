import { addDoc, arrayRemove, arrayUnion, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase";

// Effacement automatique après 12 mois (politique TTL Firestore sur « expireAt », voir PUBLIER-LES-REGLES.md)
export const REPORT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

export async function reportUser(reporterId: string, roomId: string, reportedId?: string) {
  await addDoc(collection(db, "reports"), {
    reporterId,
    reportedId: reportedId ?? null,
    roomId,
    reason: "Signalement depuis VimoX",
    createdAt: serverTimestamp(),
    expireAt: new Date(Date.now() + REPORT_RETENTION_MS),
  });
}

export async function blockUser(userId: string, blockedId: string) {
  await updateDoc(doc(db, "users", userId), {
    blockedUserIds: arrayUnion(blockedId)
  });
}

export async function unblockUser(userId: string, blockedId: string) {
  await updateDoc(doc(db, "users", userId), {
    blockedUserIds: arrayRemove(blockedId),
  });
}

// Message envoyé à l'équipe (signaler un problème, contacter le support)
export async function sendSupportRequest(input: {
  userId: string;
  userName: string;
  email: string;
  type: "bug" | "support";
  message: string;
}) {
  await addDoc(collection(db, "supportRequests"), {
    ...input,
    message: input.message.trim().slice(0, 2000),
    appVersion: "1.0.0",
    createdAt: serverTimestamp(),
  });
}

// ── Signalements ─────────────────────────────────────────────────────
export type ReportKind = "profile" | "story" | "friendChat" | "message" | "snap";

// Signale une personne ou un contenu. L'équipe lit la collection « reports » (console Firebase).
export async function reportContent(input: {
  reporterId: string;
  reportedId: string;
  kind: ReportKind;
  reason: string;
  refId?: string; // identifiant du contenu (story, message…)
  chatId?: string; // conversation concernée
}) {
  await addDoc(collection(db, "reports"), {
    type: "user",
    reporterId: input.reporterId,
    reportedId: input.reportedId,
    kind: input.kind,
    reason: input.reason.slice(0, 120),
    refId: input.refId ?? null,
    chatId: input.chatId ?? null,
    status: "open",
    createdAt: serverTimestamp(),
    expireAt: new Date(Date.now() + REPORT_RETENTION_MS),
  });
}
