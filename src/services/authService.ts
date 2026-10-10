import{EmailAuthProvider,reauthenticateWithCredential,deleteUser}from"firebase/auth";
import{doc,serverTimestamp,setDoc,deleteDoc}from"firebase/firestore";
import{auth,db}from"../config/firebase";
import{Gender,VimoXUser}from"../models/types";
import{env}from"../config/env";
import{setCurrentUser}from"./authState";

type RegisterInput={
  name:string;age:number;email:string;password:string;
  gender:Exclude<Gender,"Tous">;country:string;
};

const API_KEY=env.firebaseApiKey;
const BASE="https://identitytoolkit.googleapis.com/v1/accounts";

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
  await setDoc(doc(db,"users",data.localId),{...user,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  await setCurrentUser({uid:data.localId,email:input.email,idToken:data.idToken,refreshToken:data.refreshToken});
}

export async function signInUser(email:string,password:string){
  const data=await restPost(":signInWithPassword",{email,password,returnSecureToken:true});
  await setCurrentUser({uid:data.localId,email:data.email,idToken:data.idToken,refreshToken:data.refreshToken});
  return data;
}

export async function forgotPassword(email:string){
  await restPost(":sendOobCode",{requestType:"PASSWORD_RESET",email});
}

export async function signOutUser(){
  await setCurrentUser(null);
}

export async function deleteAccount(currentPassword:string){
  const user=auth?.currentUser;
  if(!user?.email)throw new Error("Aucun utilisateur connecté");
  const credential=EmailAuthProvider.credential(user.email,currentPassword);
  await reauthenticateWithCredential(user,credential);
  const uid=user.uid;
  await deleteDoc(doc(db,"users",uid));
  await deleteDoc(doc(db,"waitingUsers",uid)).catch(()=>{});
  await deleteUser(user);
}