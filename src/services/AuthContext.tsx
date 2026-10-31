/*VIMOX-V19*/
/*VIMOX-V17*/
import{createContext,PropsWithChildren,useContext,useEffect,useMemo,useRef,useState}from"react";
import { logDenied } from "./firestoreErrors";
import{AppState,AppStateStatus}from"react-native";
import{onAuthStateChanged}from"firebase/auth";
import{deleteField,doc,onSnapshot,updateDoc,serverTimestamp}from"firebase/firestore";
import{auth,db}from"../config/firebase";
import{VimoXUser}from"../models/types";
import{registerPushToken,clearBadge}from"./notificationService";
import{onAuthChanged,loadStoredUser,AuthUser,setCurrentUser,getCurrentUser}from"./authState";
import{secureSignOut}from"./authService";
import{unregisterPushToken}from"./notificationService";
import{clearAllLocalHistory}from"./localHistory";
import{HEARTBEAT_MS}from"./presence";
import{watchPremium,logoutPurchases}from"./purchaseService";
import{syncSearchIndex}from"./searchService";
import{migrateAgeIfNeeded,subscribePrivateInfo}from"./privateProfile";

type AuthContextValue={
  firebaseUser:AuthUser|null;
  profile:VimoXUser|null;
  loading:boolean;
  secure:boolean; // connexion Firebase officielle active (nécessaire pour les règles de sécurité)
  logout:()=>Promise<void>;
};

const AuthContext=createContext<AuthContextValue|null>(null);

// Respecte le réglage « Afficher que je suis en ligne » : si l'utilisateur l'a désactivé,
// on n'écrit jamais isOnline=true.
let showOnline=true;
async function setOnlineStatus(uid:string,isOnline:boolean){
  try{await updateDoc(doc(db,"users",uid),{isOnline:isOnline&&showOnline,lastSeen:serverTimestamp()});}catch{}
}

export function AuthProvider({children}:PropsWithChildren){
  const[firebaseUser,setFirebaseUser]=useState<AuthUser|null>(null);
  const[profile,setProfile]=useState<VimoXUser|null>(null);
  const[loading,setLoading]=useState(true);
  const[secure,setSecure]=useState(false);
  const lastProfileKey=useRef("");
  const emailCleaned=useRef(false);
  // Âge privé (users/<uid>/private/info) : jamais dans le profil public
  const[privAge,setPrivAge]=useState<number|null>(null);
  const[privReady,setPrivReady]=useState(false);
  const ageMigrated=useRef(false);
  // Dernier âge connu : évite tout clignotement pendant la migration
  const lastAgeRef=useRef<number|undefined>(undefined);

  useEffect(()=>{
    loadStoredUser();
    return onAuthChanged(user=>{
      setFirebaseUser(user);
      if(!user){setProfile(null);setLoading(false);}
    });
  },[]);

  useEffect(()=>{
    if(!firebaseUser){return;}
    registerPushToken(firebaseUser.uid);
    clearBadge();
    const stopPremium=watchPremium(firebaseUser.uid);
    let first=true;
    const unsub=onSnapshot(doc(db,"users",firebaseUser.uid),snap=>{
      if(!snap.exists()){setLoading(false);return;}
      const data=snap.data();
      // Sans la présence : isOnline/lastSeen changent chaque minute et ne concernent pas l'écran
      const{isOnline:_o,lastSeen:_l,...stable}=data as any;
      const key=snap.id+JSON.stringify(stable);
      if(key!==lastProfileKey.current){
        lastProfileKey.current=key;
        // L'e-mail vient de la session sur le téléphone (jamais du profil public)
        setProfile({id:snap.id,...(data as Omit<VimoXUser,"id">),email:getCurrentUser()?.email??(data as any).email??""});
      }
      // Nettoyage des anciens comptes : l'e-mail n'a rien à faire dans le profil public
      if((data as any).email!==undefined&&!emailCleaned.current){
        emailCleaned.current=true;
        updateDoc(doc(db,"users",snap.id),{email:deleteField()}).catch(()=>{});
      }
      // Ancien compte : l'âge public part dans l'espace privé (une seule fois)
      if(typeof (data as any).age==="number"&&!ageMigrated.current){
        ageMigrated.current=true;
        // Une seule tentative par ouverture de l'app (plus de boucle si Firebase refuse)
        migrateAgeIfNeeded(snap.id,(data as any).age).catch(()=>{});
      }
      setLoading(false);
      // La présence est écrite une fois le réglage de confidentialité connu
      const visible=(data as any)?.showOnlineStatus!==false;
      if(first||visible!==showOnline){
        first=false;
        showOnline=visible;
        setOnlineStatus(firebaseUser.uid,AppState.currentState==="active");
      }
    }, (e)=>{logDenied("profil",e);setLoading(false);});
    return()=>{unsub();stopPremium();};
  },[firebaseUser]);

  useEffect(()=>{
    if(!firebaseUser){setPrivAge(null);setPrivReady(false);ageMigrated.current=false;lastAgeRef.current=undefined;return;}
    setPrivReady(false);
    return subscribePrivateInfo(firebaseUser.uid,(info)=>{
      setPrivAge(info.age);
      setPrivReady(true);
    });
  },[firebaseUser]);

  // Profil vu par l'app : l'âge vient de l'espace privé (ou de l'ancien profil tant qu'il n'est pas migré)
  const mergedProfile=useMemo<VimoXUser|null>(()=>{
    if(!profile)return null;
    const pub=(profile as any).age;
    const a=privAge??(typeof pub==="number"?pub:undefined)??lastAgeRef.current;
    if(typeof a==="number")lastAgeRef.current=a;
    return{...profile,age:a as number};
  },[profile,privAge]);

  useEffect(()=>{
    if(!firebaseUser)return;
    const handleAppStateChange=(nextState:AppStateStatus)=>{
      if(nextState==="active"){setOnlineStatus(firebaseUser.uid,true);clearBadge();}
      else if(nextState==="background"||nextState==="inactive"){setOnlineStatus(firebaseUser.uid,false);}
    };
    const sub=AppState.addEventListener("change",handleAppStateChange);
    return()=>sub.remove();
  },[firebaseUser]);

  // L'index de recherche (prénom, photo, pays) suit le profil : créé, mis à jour ou supprimé selon le réglage
  useEffect(()=>{
    if(!mergedProfile||typeof mergedProfile.age!=="number")return;
    syncSearchIndex(mergedProfile).catch(()=>{});
  },[mergedProfile?.id,mergedProfile?.name,mergedProfile?.profilePhotoURL,mergedProfile?.country,mergedProfile?.age,mergedProfile?.discoverable,mergedProfile?.username]);

  // Suivi de la connexion Firebase officielle (pour l'indicateur des Paramètres)
  useEffect(()=>{
    if(!auth)return;
    return onAuthStateChanged(auth,(u:any)=>setSecure(!!u),()=>setSecure(false));
  },[]);

  // Battement de cœur : prouve que l'app est réellement ouverte (isOnline seul reste « true »
  // si l'app est fermée de force)
  useEffect(()=>{
    if(!firebaseUser)return;
    const id=setInterval(()=>{
      if(AppState.currentState==="active")setOnlineStatus(firebaseUser.uid,true);
    },HEARTBEAT_MS);
    return()=>clearInterval(id);
  },[firebaseUser]);

  async function logout(){
    if(firebaseUser){
      await setOnlineStatus(firebaseUser.uid,false);
      await unregisterPushToken(firebaseUser.uid);
    }
    await logoutPurchases().catch(()=>{});
    await secureSignOut();
    await clearAllLocalHistory().catch(()=>{});
    await setCurrentUser(null);
  }

  const value=useMemo<AuthContextValue>(
    ()=>({
      firebaseUser,
      profile:mergedProfile,
      // On attend l'âge privé : sans lui, la tranche d'âge (mineur / adulte) serait inconnue
      loading:loading||(!!firebaseUser&&!!profile&&!privReady),
      secure,
      logout,
    }),
    [firebaseUser,mergedProfile,loading,privReady,profile,secure],
  );

  return<AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(){
  const value=useContext(AuthContext);
  if(!value)throw new Error("useAuth doit être utilisé dans AuthProvider");
  return value;
}