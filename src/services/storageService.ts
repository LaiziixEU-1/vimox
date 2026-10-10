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

  if (!response.ok) throw new Error("Erreur upload Cloudinary");
  const data = await response.json();
  return data.secure_url;
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
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
