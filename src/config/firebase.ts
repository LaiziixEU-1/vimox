import{initializeApp,getApps,getApp}from"firebase/app";
import{initializeAuth,inMemoryPersistence}from"firebase/auth";
import{getFirestore}from"firebase/firestore";
import{getStorage}from"firebase/storage";
import{env,isFirebaseConfigured}from"./env";

const firebaseConfig={
  apiKey:env.firebaseApiKey,
  authDomain:env.firebaseAuthDomain,
  projectId:env.firebaseProjectId,
  storageBucket:env.firebaseStorageBucket,
  messagingSenderId:env.firebaseMessagingSenderId,
  appId:env.firebaseAppId,
};

if(!isFirebaseConfigured()){
  throw new Error("Configuration Firebase manquante.");
}

const app=getApps().length?getApp():initializeApp(firebaseConfig);

let auth:any;
try{
  auth=initializeAuth(app,{persistence:inMemoryPersistence});
}catch(e){
  console.warn("Firebase Auth init failed:",e);
  auth=null;
}

export{auth};
export const db=getFirestore(app);
export const storage=getStorage(app);