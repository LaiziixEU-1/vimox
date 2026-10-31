import * as ImagePicker from "expo-image-picker";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "../config/env";

// Upload une photo sur Cloudinary
export async function uploadToCloudinary(
  localUri: string,
  folder: string = "profiles",
): Promise<string> {
  const formData = new FormData();
  formData.append("file", {
    uri: localUri,
    type: "image/jpeg",
    name: `upload_${Date.now()}.jpg`,
  } as any);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData },
  );

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.secure_url) {
    throw new Error(data?.error?.message ?? "Erreur upload Cloudinary");
  }
  return data.secure_url as string;
}

// Upload photo de profil
export async function uploadProfilePhoto(
  userId: string,
  localUri: string,
  onProgress?: (p: { progress: number }) => void,
): Promise<string> {
  onProgress?.({ progress: 30 });
  const url = await uploadToCloudinary(localUri, `profiles/${userId}`);
  onProgress?.({ progress: 100 });
  return url;
}

// Upload photo de chat
export async function uploadChatPhoto(
  roomId: string,
  senderId: string,
  localUri: string,
): Promise<string> {
  return uploadToCloudinary(localUri, `chats/${roomId}`);
}

// Upload story
export async function uploadStoryPhoto(
  userId: string,
  localUri: string,
): Promise<string> {
  return uploadToCloudinary(localUri, `stories/${userId}`);
}

// Picker galerie
export async function pickProfileImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") throw new Error("Permission galerie refusée");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"] as any,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

// Caméra
export async function takeProfilePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") throw new Error("Permission caméra refusée");
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

// Message vocal : envoyé sur Cloudinary (type « video » = audio aussi) puis référencé par son lien.
// Avant, le son entier était encodé en base64 DANS le message Firestore (jusqu'à ~600 Ko par message,
// retéléchargé à chaque mise à jour de la conversation).
export async function uploadAudioFile(localUri: string, folder: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", {
    uri: localUri,
    type: "audio/m4a",
    name: `voice_${Date.now()}.m4a`,
  } as any);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", folder);
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
    { method: "POST", body: formData },
  );
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.secure_url) {
    throw new Error(data?.error?.message ?? "Erreur d'envoi de l'audio");
  }
  return data.secure_url as string;
}
