import{createContext,PropsWithChildren,useContext,useEffect,useMemo,useState}from"react";
import{AppState,AppStateStatus}from"react-native";
import{doc,onSnapshot,updateDoc,serverTimestamp}from"firebase/firestore";
import{db}from"../config/firebase";
import{VimoXUser}from"../models/types";
import{registerPushToken,clearBadge}from"./notificationService";
import{onAuthChanged,loadStoredUser,AuthUser,setCurrentUser}from"./authState";

type AuthContextValue={
  firebaseUser:AuthUser|null;
  profile:VimoXUser|null;
  loading:boolean;
  logout:()=>Promise<void>;
};

const AuthContext=createContext<AuthContextValue|null>(null);

async function setOnlineStatus(uid:string,isOnline:boolean){
  try{await updateDoc(doc(db,"users",uid),{isOnline,lastSeen:serverTimestamp()});}catch{}
}

export function AuthProvider({children}:PropsWithChildren){
  const[firebaseUser,setFirebaseUser]=useState<AuthUser|null>(null);
  const[profile,setProfile]=useState<VimoXUser|null>(null);
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    loadStoredUser();
    return onAuthChanged(user=>{
      setFirebaseUser(user);
      if(!user){setProfile(null);setLoading(false);}
    });
  },[]);

  useEffect(()=>{
    if(!firebaseUser){return;}
    setOnlineStatus(firebaseUser.uid,true);
    registerPushToken(firebaseUser.uid);
    clearBadge();
    const unsub=onSnapshot(doc(db,"users",firebaseUser.uid),snap=>{
      if(!snap.exists()){setLoading(false);return;}
      setProfile({id:snap.id,...(snap.data()as Omit<VimoXUser,"id">)});
      setLoading(false);
    });
    return unsub;
  },[firebaseUser]);

  useEffect(()=>{
    if(!firebaseUser)return;
    const handleAppStateChange=(nextState:AppStateStatus)=>{
      if(nextState==="active"){setOnlineStatus(firebaseUser.uid,true);clearBadge();}
      else if(nextState==="background"||nextState==="inactive"){setOnlineStatus(firebaseUser.uid,false);}
    };
    const sub=AppState.addEventListener("change",handleAppStateChange);
    return()=>sub.remove();
  },[firebaseUser]);

  async function logout(){
    if(firebaseUser)await setOnlineStatus(firebaseUser.uid,false);
    await setCurrentUser(null);
  }

  const value=useMemo<AuthContextValue>(
    ()=>({firebaseUser,profile,loading,logout}),
    [firebaseUser,profile,loading],
  );

  return<AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(){
  const value=useContext(AuthContext);
  if(!value)throw new Error("useAuth doit être utilisé dans AuthProvider");
  return value;
}