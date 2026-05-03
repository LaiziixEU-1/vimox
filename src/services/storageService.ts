import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { storage, db } from "../config/firebase";

export interface UploadProgress {
  progress: number;
  status: "uploading" | "done" | "error";
}

export async function pickProfileImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Permission refusée pour accéder à la galerie");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled) return null;
  return result.assets[0].uri;
}

export async function takeProfilePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Permission refusée pour accéder à la caméra");
  }
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled) return null;
  return result.assets[0].uri;
}

export async function uploadProfilePhoto(
  uid: string,
  localUri: string,
  onProgress?: (p: UploadProgress) => void,
): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();

  const storageRef = ref(storage, `profiles/${uid}/avatar.jpg`);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: "image/jpeg",
    });

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
        );
        onProgress?.({ progress, status: "uploading" });
      },
      (error) => {
        onProgress?.({ progress: 0, status: "error" });
        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await updateDoc(doc(db, "users", uid), {
          photoURL: downloadURL,
          updatedAt: serverTimestamp(),
        });
        onProgress?.({ progress: 100, status: "done" });
        resolve(downloadURL);
      },
    );
  });
}

export async function deleteProfilePhoto(uid: string): Promise<void> {
  const storageRef = ref(storage, `profiles/${uid}/avatar.jpg`);
  try {
    await deleteObject(storageRef);
    await updateDoc(doc(db, "users", uid), {
      photoURL: null,
      updatedAt: serverTimestamp(),
    });
  } catch (e: any) {
    if (e.code !== "storage/object-not-found") throw e;
  }
}
