import{initializeApp,getApps,getApp}from"firebase/app";
import{getFunctions}from"firebase/functions";
import*as FirebaseAuth from"firebase/auth";
import AsyncStorage from"@react-native-async-storage/async-storage";
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
  // Session mémorisée sur le téléphone (sinon il faudrait se reconnecter à chaque lancement)
  const rnPersistence=(FirebaseAuth as any).getReactNativePersistence;
  auth=FirebaseAuth.initializeAuth(app,{
    persistence:rnPersistence?rnPersistence(AsyncStorage):FirebaseAuth.inMemoryPersistence,
  });
}catch(e){
  console.warn("Firebase Auth init failed:",e);
  auth=null;
}

export{auth};
export const db=getFirestore(app);
export const storage=getStorage(app);
// Fonctions serveur (vérification des abonnements Vim+, etc.)
export const functions=getFunctions(app);