import { addDoc, arrayUnion, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase";

export async function reportUser(reporterId: string, roomId: string, reportedId?: string) {
  await addDoc(collection(db, "reports"), {
    reporterId,
    reportedId: reportedId ?? null,
    roomId,
    reason: "Signalement depuis VimoX",
    createdAt: serverTimestamp()
  });
}

export async function blockUser(userId: string, blockedId: string) {
  await updateDoc(doc(db, "users", userId), {
    blockedUserIds: arrayUnion(blockedId)
  });
}

