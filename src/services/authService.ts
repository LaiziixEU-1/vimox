/*VIMOX-V17*/
import{signInWithEmailAndPassword,signOut as fbSignOut}from"firebase/auth";
import{collection,deleteDoc,doc,getDoc,getDocs,query,serverTimestamp,setDoc,updateDoc,where,writeBatch}from"firebase/firestore";
import{auth,db}from"../config/firebase";
import{clearAllLocalHistory}from"./localHistory";
import{Gender,VimoXUser}from"../models/types";
import{env}from"../config/env";
import{getCurrentUser,setCurrentUser}from"./authState";
import{removeFromSearchIndex}from"./searchService";
import{privateRef}from"./privateProfile";

type RegisterInput={
  name:string;age:number;email:string;password:string;
  gender:Exclude<Gender,"Tous">;country:string;
};

const API_KEY=env.firebaseApiKey;
const BASE="https://identitytoolkit.googleapis.com/v1/accounts";

// Connexion Firebase OFFICIELLE, en plus de la connexion REST de l'app.
// Sans elle, Firestore ne sait pas qui fait les requêtes : impossible d'écrire des règles de
// sécurité. Cette fonction ne fait JAMAIS échouer la connexion : si elle échoue, l'app marche
// comme avant (Paramètres indique alors « connexion sécurisée : inactive »).
// Dernière raison d'échec de la connexion sécurisée : affichée dans Paramètres pour faciliter le dépannage
let lastSecureError="";
export function getSecureError():string{return lastSecureError;}

export async function secureSignIn(email:string,password:string):Promise<boolean>{
  lastSecureError="";
  try{
    if(!auth){lastSecureError="auth-non-initialisee";return false;}
    if(auth.currentUser?.email?.toLowerCase()===email.toLowerCase())return true;
    await Promise.race([
      signInWithEmailAndPassword(auth,email,password),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error("timeout")),8000)),
    ]);
    return true;
  }catch(e:any){
    lastSecureError=String(e?.code??e?.message??"inconnue").slice(0,60);
    return false;
  }
}

export async function secureSignOut():Promise<void>{
  try{if(auth)await fbSignOut(auth);}catch{}
}

async function restPost(endpoint:string,body:object){
  const res=await fetch(`${BASE}${endpoint}?key=${API_KEY}`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body),
  });
  const data=await res.json();
  if(data.error)throw new Error(data.error.message);
  return data;
}

export async function registerUser(input:RegisterInput){
  if(input.age<16)throw new Error("L'âge minimum est 16 ans.");
  const data=await restPost(":signUp",{email:input.email,password:input.password,returnSecureToken:true});
  await restPost(":sendOobCode",{requestType:"VERIFY_EMAIL",idToken:data.idToken}).catch(()=>{});
  const user:VimoXUser={
    id:data.localId,name:input.name,age:input.age,email:input.email,
    gender:input.gender,country:input.country,
    profilePhotoURL:null,isPremium:false,blockedUserIds:[],
  };
  await secureSignIn(input.email,input.password);
  try{
    let lastError:unknown=null;
    for(let attempt=0;attempt<3;attempt++){
      try{
        // L'e-mail n'est PAS enregistré dans le profil (lisible par les autres comptes connectés) :
        // il reste sur le téléphone, dans la session.
        // L'âge part dans l'espace PRIVÉ (visible seulement par soi, et par ses matchs en conversation)
        const{email:_email,age:_age,...publicProfile}=user;
        const batch=writeBatch(db);
        batch.set(privateRef(data.localId),{age:input.age,createdAt:serverTimestamp()});
        batch.set(doc(db,"users",data.localId),{...publicProfile,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
        await batch.commit();
        lastError=null;
        break;
      }catch(e){lastError=e;await new Promise(r=>setTimeout(r,400*(attempt+1)));}
    }
    if(lastError)throw lastError;
  }catch(e){
    // Sans profil, le compte serait inutilisable (email déjà pris, connexion impossible) :
    // on le supprime pour que l'inscription puisse être refaite proprement.
    await restPost(":delete",{idToken:data.idToken}).catch(()=>{});
    throw e;
  }
  await setCurrentUser({uid:data.localId,email:input.email,idToken:data.idToken,refreshToken:data.refreshToken});
}

export async function signInUser(email:string,password:string){
  const data=await restPost(":signInWithPassword",{email,password,returnSecureToken:true});
  await secureSignIn(email,password);
  await setCurrentUser({uid:data.localId,email:data.email,idToken:data.idToken,refreshToken:data.refreshToken});
  return data;
}

export async function forgotPassword(email:string){
  await restPost(":sendOobCode",{requestType:"PASSWORD_RESET",email});
}

export async function signOutUser(){
  await secureSignOut();
  await clearAllLocalHistory().catch(() => {});
  await setCurrentUser(null);
}

// Connexion : Firebase répond INVALID_LOGIN_CREDENTIALS quand l'email OU le mot de passe est faux
export function loginErrorMessage(e: unknown): string {
  const m = String((e as any)?.message ?? e);
  if (/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND|INVALID_EMAIL/.test(m)) return "Email ou mot de passe incorrect.";
  if (/USER_DISABLED/.test(m)) return "Ce compte a été désactivé.";
  if (/TOO_MANY_ATTEMPTS/.test(m)) return "Trop de tentatives. Réessaie dans quelques minutes ou réinitialise ton mot de passe.";
  if (/network|fetch/i.test(m)) return "Pas de connexion internet.";
  return "Connexion impossible. Réessaie.";
}

export function registrationErrorMessage(e: unknown): string {
  const m = String((e as any)?.message ?? e);
  if (/EMAIL_EXISTS/.test(m)) return "Cet email est déjà utilisé.";
  if (/INVALID_EMAIL/.test(m)) return "Cet email n'est pas valide.";
  if (/WEAK_PASSWORD/.test(m)) return "Mot de passe trop faible (6 caractères minimum).";
  if (/TOO_MANY_ATTEMPTS/.test(m)) return "Trop de tentatives. Réessaie dans quelques minutes.";
  if (/âge minimum/i.test(m)) return m;
  return "Inscription impossible. Vérifie ta connexion et réessaie.";
}

// Messages d'erreur lisibles pour les erreurs renvoyées par Firebase Auth
export function friendlyAuthError(e: unknown): string {
  const m = String((e as any)?.message ?? e);
  if (/INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND/.test(m)) return "Mot de passe incorrect.";
  if (/TOO_MANY_ATTEMPTS/.test(m)) return "Trop de tentatives. Réessaie dans quelques minutes.";
  if (/WEAK_PASSWORD/.test(m)) return "Mot de passe trop faible (6 caractères minimum).";
  if (/CREDENTIAL_TOO_OLD|TOKEN_EXPIRED|INVALID_ID_TOKEN/.test(m)) return "Session expirée : reconnecte-toi puis réessaie.";
  if (/network|fetch/i.test(m)) return "Pas de connexion internet.";
  return m;
}

// Ré-authentifie avec le mot de passe actuel : renvoie un jeton tout neuf (action sensible)
async function reauthenticate(currentPassword: string) {
  const user = getCurrentUser();
  if (!user?.email) throw new Error("Aucun utilisateur connecté");
  return restPost(":signInWithPassword", {
    email: user.email,
    password: currentPassword,
    returnSecureToken: true,
  });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  if (newPassword.length < 6) throw new Error("WEAK_PASSWORD");
  const fresh = await reauthenticate(currentPassword);
  const updated = await restPost(":update", {
    idToken: fresh.idToken,
    password: newPassword,
    returnSecureToken: true,
  });
  // L'ancien jeton n'est plus valable : on enregistre le nouveau
  await setCurrentUser({
    uid: fresh.localId,
    email: fresh.email ?? getCurrentUser()?.email ?? "",
    idToken: updated.idToken ?? fresh.idToken,
    refreshToken: updated.refreshToken ?? fresh.refreshToken,
  });
}

// Supprime toutes les données d'une personne dans Firestore (messages inclus)
async function deleteWhere(col: string, field: string, op: "==" | "array-contains", value: string) {
  const snap = await getDocs(query(collection(db, col), where(field, op, value)));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function purgeUserData(uid: string) {
  // 1) Ses messages dans les conversations d'amis et de matchs
  const friendsSnap = await getDocs(query(collection(db, "friends"), where("userId", "==", uid)));
  for (const f of friendsSnap.docs) {
    const friendId = f.data().id as string;
    const cid = [uid, friendId].sort().join("_");
    await deleteWhere(`friendChats/${cid}/messages`, "senderUid", "==", uid).catch(() => {});
    await deleteDoc(doc(db, "mutes", `${uid}_${friendId}`)).catch(() => {}); // mes sourdines pour cet ami
  }
  const roomsSnap = await getDocs(query(collection(db, "rooms"), where("participants", "array-contains", uid)));
  for (const r of roomsSnap.docs) {
    await deleteWhere(`rooms/${r.id}/messages`, "senderId", "==", uid).catch(() => {});
  }
  // 2) Le reste de ses données
  await Promise.all([
    deleteWhere("friends", "userId", "==", uid),
    deleteWhere("friends", "id", "==", uid),
    deleteWhere("friendRequests", "fromUid", "==", uid),
    deleteWhere("friendRequests", "toUid", "==", uid),
    deleteWhere("stories", "userId", "==", uid),
    deleteWhere("memories", "userId", "==", uid),
    deleteWhere("customStickers", "userId", "==", uid),
    deleteWhere("matchCooldowns", "user", "==", uid),
    deleteWhere("matchCooldowns", "partner", "==", uid),
    deleteWhere("restoreCredits", "userId", "==", uid),
    deleteWhere("streaks", "users", "array-contains", uid),
  ]);
  await deleteDoc(doc(db, "waitingUsers", uid)).catch(() => {});
  await removeFromSearchIndex(uid);
  // Le pseudo redevient disponible (lu dans le profil AVANT de le supprimer)
  const mine = await getDoc(doc(db, "users", uid)).catch(() => null);
  const handle = (mine?.data() as any)?.username;
  if (handle) await deleteDoc(doc(db, "usernames", handle)).catch(() => {});
  // Groupes : la personne en est retirée (les règles autorisent à se retirer soi-même)
  const groupsSnap = await getDocs(query(collection(db, "groups"), where("members", "array-contains", uid))).catch(() => null);
  for (const g of groupsSnap?.docs ?? []) {
    const members = ((g.data() as any).members ?? []).filter((m: string) => m !== uid);
    await updateDoc(g.ref, { members }).catch(() => {});
  }
  // Sons enregistrés (privés)
  const soundsSnap = await getDocs(collection(db, "users", uid, "savedSounds")).catch(() => null);
  for (const d of soundsSnap?.docs ?? []) await deleteDoc(d.ref).catch(() => {});
  await deleteDoc(privateRef(uid)).catch(() => {}); // âge privé
  await deleteDoc(doc(db, "users", uid));
}

// Suppression définitive du compte :
// 1) mot de passe vérifié, 2) données effacées, 3) compte d'authentification supprimé.
// Si l'étape 3 échoue, on peut réessayer sans rien perdre (l'étape 2 est rejouable).
export async function deleteAccount(currentPassword: string) {
  const fresh = await reauthenticate(currentPassword);
  await purgeUserData(fresh.localId);
  await restPost(":delete", { idToken: fresh.idToken });
  await secureSignOut();
  // Plus aucune conversation ne reste sur le téléphone
  await clearAllLocalHistory().catch(() => {});
  await setCurrentUser(null);
}

// Pour quelqu'un déjà connecté avant la mise à jour : active la connexion sécurisée
// en redonnant son mot de passe (Paramètres > Sécurité).
export async function enableSecureSession(password: string): Promise<boolean> {
  const user = getCurrentUser();
  if (!user?.email) throw new Error("Aucun utilisateur connecté");
  // Vérifie d'abord le mot de passe (erreur claire s'il est faux)
  await restPost(":signInWithPassword", {
    email: user.email,
    password,
    returnSecureToken: true,
  });
  return secureSignIn(user.email, password);
}
