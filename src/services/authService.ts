import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { Gender, VimoXUser } from "../models/types";

type RegisterInput = {
  name: string;
  age: number;
  email: string;
  password: string;
  gender: Exclude<Gender, "Tous">;
  country: string;
};

export async function registerUser(input: RegisterInput) {
  if (input.age < 16) throw new Error("L'âge minimum est 16 ans.");

  const credential = await createUserWithEmailAndPassword(
    auth,
    input.email,
    input.password,
  );
  const uid = credential.user.uid;

  await sendEmailVerification(credential.user);

  const user: VimoXUser = {
    id: uid,
    name: input.name,
    age: input.age,
    email: input.email,
    gender: input.gender,
    country: input.country,
    profilePhotoURL: null,
    isPremium: false,
    blockedUserIds: [],
  };

  await setDoc(doc(db, "users", uid), {
    ...user,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function forgotPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export async function deleteAccount(currentPassword: string) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error("Aucun utilisateur connecté");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  const uid = user.uid;
  await deleteDoc(doc(db, "users", uid));
  await deleteDoc(doc(db, "waitingUsers", uid)).catch(() => {});
  await deleteUser(user);
}
