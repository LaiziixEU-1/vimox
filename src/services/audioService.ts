import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";

export async function uploadAudio(
  localUri: string,
  senderId: string,
  chatId: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const fileName = `${Date.now()}_${senderId}.m4a`;
  const storage = getStorage();
  const storageRef = ref(storage, `voiceMessages/${chatId}/${fileName}`);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: "audio/m4a",
    });
    uploadTask.on(
      "state_changed",
      (snapshot) =>
        onProgress?.(snapshot.bytesTransferred / snapshot.totalBytes),
      (error) => reject(error),
      async () => resolve(await getDownloadURL(uploadTask.snapshot.ref)),
    );
  });
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
