import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../config/firebase";
import { Gender, VimoXUser } from "../models/types";

type RegisterInput = {
  name: string;
  age: number;
  email: string;
  password: string;
  gender: Exclude<Gender, "Tous">;
  country: string;
  imageUri?: string;
};

export async function registerUser(input: RegisterInput) {
  if (input.age < 16) throw new Error("L'âge minimum est 16 ans.");

  const credential = await createUserWithEmailAndPassword(
    auth,
    input.email,
    input.password,
  );
  const uid = credential.user.uid;
  const profilePhotoURL = input.imageUri
    ? await uploadProfilePhoto(uid, input.imageUri)
    : undefined;

  const user: VimoXUser = {
    id: uid,
    name: input.name,
    age: input.age,
    email: input.email,
    gender: input.gender,
    country: input.country,
    profilePhotoURL: profilePhotoURL ?? null,
    isPremium: false,
    blockedUserIds: [],
  };

  await setDoc(doc(db, "users", uid), {
    ...user,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

async function uploadProfilePhoto(uid: string, uri: string) {
  const response = await fetch(uri);
  const blob = await response.blob();
  const imageRef = ref(storage, `profiles/${uid}.jpg`);
  await uploadBytes(imageRef, blob);
  return getDownloadURL(imageRef);
}
