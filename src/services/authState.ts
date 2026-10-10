import AsyncStorage from"@react-native-async-storage/async-storage";

export type AuthUser={uid:string;email:string;idToken:string;refreshToken:string};
type Listener=(user:AuthUser|null)=>void;

const AUTH_KEY="vimox:currentUser";
let currentUser:AuthUser|null=null;
const listeners:Listener[]=[];

export function onAuthChanged(fn:Listener){
  listeners.push(fn);
  fn(currentUser);
  return()=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1);};
}

export async function setCurrentUser(user:AuthUser|null){
  currentUser=user;
  if(user)await AsyncStorage.setItem(AUTH_KEY,JSON.stringify(user));
  else await AsyncStorage.removeItem(AUTH_KEY);
  listeners.forEach(fn=>fn(user));
}

export function getCurrentUser(){return currentUser;}

export async function loadStoredUser():Promise<void>{
  try{
    const stored=await AsyncStorage.getItem(AUTH_KEY);
    if(stored){currentUser=JSON.parse(stored);}
    listeners.forEach(fn=>fn(currentUser));
  }catch{
    listeners.forEach(fn=>fn(null));
  }
}