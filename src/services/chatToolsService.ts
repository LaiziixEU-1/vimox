/*VIMOX-V25*/
import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "../config/firebase";
import { getChatId } from "./snapService";

// Efface TOUS les messages que J'AI envoyés dans une conversation d'amis (Vims, vocaux, photos, textes), pour
// tout le monde : ils disparaissent aussi chez l'ami. Les messages de l'ami ne sont pas touchés.
export async function deleteMyMessages(me: string, friendId: string): Promise<number> {
  const cid = getChatId(me, friendId);
  const snap = await getDocs(query(collection(db, "friendChats", cid, "messages"), where("senderUid", "==", me)));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => {
      if (d.data()?.deleted === true) return;
      const x: any = d.data();
      const kind = x.isSnap ? "snap" : x.audioURL ? "audio" : x.imageURL ? "photo" : "chat";
      batch.update(d.ref, {
        deleted: true,
        deletedKind: kind,
        text: "",
        imageURL: null,
        videoURL: null,
        audioURL: null,
        musicURL: null,
        musicMeta: null,
        replyTo: null,
        reactions: {},
      });
    });
    await batch.commit();
  }
  return snap.docs.length;
}
