/*VIMOX-V17*/
import{useEffect,useRef,useState}from"react";
import { logDenied } from "../services/firestoreErrors";
import{ActivityIndicator,Alert,Image,Linking,Pressable,ScrollView,StyleSheet,Text,View}from"react-native";
import{useCameraPermissions,useMicrophonePermissions}from"expo-camera";
import{NativeStackScreenProps}from"@react-navigation/native-stack";
import{addDoc,collection,doc,getDoc,onSnapshot,serverTimestamp,setDoc}from"firebase/firestore";
import{RootStackParamList,VimoXUser}from"../models/types";
import{useAuth}from"../services/AuthContext";
import{VideoCallService,buildCallUrl,callRoomName,getWebViewComponent}from"../services/videoService";
import{notifyFriendCall}from"../services/notificationService";
import{colors}from"../theme/colors";
import{db}from"../config/firebase";

type Props=NativeStackScreenProps<RootStackParamList,"VideoCall">;
type Effect="Normal"|"N&B"|"Flou"|"Saturation"|"Néon"|"Avatar Pro";
const effects:Effect[]=["Normal","N&B","Flou","Saturation","Néon","Avatar Pro"];

// Module optionnel (npx expo install react-native-webview) : sans lui, ancien écran d'appel
const WebViewComp=getWebViewComponent();

export function VideoCallScreen({route,navigation}:Props){
  const{profile}=useAuth();
  const{roomId,audioOnly,joining,friend}=route.params;
  const serviceRef=useRef<VideoCallService|null>(null);
  const[isMuted,setIsMuted]=useState(false);
  const[isCameraOff,setIsCameraOff]=useState(audioOnly??false);
  const[isAudioOnly]=useState(audioOnly??false);
  const[effect,setEffect]=useState<Effect>("Normal");
  const[duration,setDuration]=useState(0);
  const[partnerProfile,setPartnerProfile]=useState<VimoXUser|null>(null);
  // Âge du partenaire : seulement en match (copié dans la conversation)
  const[partnerAge,setPartnerAge]=useState<number|null>(null);
  const callNotifSentRef=useRef(false);
  const hangingUpRef=useRef(false);
  const startedAtRef=useRef<number|null>(null);
  const[loaded,setLoaded]=useState(false);
  const[loadError,setLoadError]=useState(false);
  const[camPerm,requestCam]=useCameraPermissions();
  const[micPerm,requestMic]=useMicrophonePermissions();
  const needsCam=!(audioOnly??false);
  const permsOk=!!micPerm?.granted&&(!needsCam||!!camPerm?.granted);
  const permsAsked=micPerm!==null&&camPerm!==null;
  const canCall=!!WebViewComp&&permsOk;

  // Micro (et caméra pour un appel vidéo) demandés avant d'ouvrir la salle
  useEffect(()=>{
    (async()=>{
      if(micPerm&&!micPerm.granted)await requestMic();
      if(needsCam&&camPerm&&!camPerm.granted)await requestCam();
    })();
  },[micPerm===null,camPerm===null]);

  // Annonce l'appel dans le chat UNE fois, seulement s'il peut vraiment avoir lieu
  // (et pas pour celui qui rejoint un appel déjà lancé)
  useEffect(()=>{
    if(!profile||!canCall||joining||callNotifSentRef.current)return;
    callNotifSentRef.current=true;
    if(friend){
      // Appel avec un ami : l'annonce arrive dans votre conversation, et l'ami est prévenu
      addDoc(collection(db,"friendChats",friend.cid,"messages"),{
        type:"call",callType:audioOnly?"audio":"video",
        callRoomId:roomId,senderUid:profile.id,senderName:profile.name,
        text:audioOnly?"📞 Appel vocal":"🎥 Appel vidéo",
        sentAt:serverTimestamp(),
      }).catch(()=>{});
      notifyFriendCall(friend.friendId,profile.id,profile.name,!!audioOnly).catch(()=>{});
    }else{
      addDoc(collection(db,"rooms",roomId,"messages"),{
        type:"call",callType:audioOnly?"audio":"video",
        callRoomId:roomId,senderId:profile.id,
        senderName:profile.name,isActive:true,
        sentAt:serverTimestamp(),
      }).catch(()=>{});
    }
  },[profile,canCall]);

  useEffect(()=>{
    if(!profile)return;
    const service=new VideoCallService(roomId,profile.id);
    serviceRef.current=service;
    if(audioOnly)service.switchToAudioOnly();

    if(friend){
      getDoc(doc(db,"users",friend.friendId)).then(userSnap=>{
        if(userSnap.exists())setPartnerProfile({id:userSnap.id,...userSnap.data()}as VimoXUser);
      }).catch(()=>{});
    }else{
      getDoc(doc(db,"rooms",roomId)).then(async snap=>{
        const participants=(snap.data()?.participants as string[])??[];
        const partnerId=participants.find(p=>p!==profile.id);
        const a=(snap.data()?.ages as any)?.[partnerId??""];
        if(typeof a==="number")setPartnerAge(a);
        if(partnerId){
          const userSnap=await getDoc(doc(db,"users",partnerId));
          if(userSnap.exists()){
            setPartnerProfile({id:userSnap.id,...userSnap.data()}as VimoXUser);
          }
        }
      });
    }

    return()=>{
      service.hangUp().catch(()=>{});
    };
  },[profile,roomId]);

  // ✅ Détecter quand l'autre raccroche
  useEffect(()=>{
    if(!profile||friend)return;
    const unsub=onSnapshot(doc(db,"rooms",roomId),(snap)=>{
      if(!snap.exists())return;
      const data=snap.data();
      if(data?.isActive===false&&!hangingUpRef.current){
        Alert.alert("Appel terminé","L'autre personne a raccroché.",[
          {text:"OK",onPress:()=>navigation.goBack()},
        ]);
      }
    }, (e) => logDenied("appel vidéo", e));
    return()=>unsub();
  },[profile,roomId]);

  useEffect(()=>{
    const timer=setInterval(()=>{
      if(WebViewComp){
        if(startedAtRef.current)setDuration(Math.floor((Date.now()-startedAtRef.current)/1000));
      }else setDuration(d=>d+1);
    },1000);
    return()=>clearInterval(timer);
  },[]);

  function formatDuration(s:number){
    const m=Math.floor(s/60);const sec=s%60;
    return`${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`;
  }

  function toggleMute(){
    if(!serviceRef.current)return;
    setIsMuted(serviceRef.current.toggleMute());
  }

  function toggleCamera(){
    if(isAudioOnly)return;
    if(!serviceRef.current)return;
    setIsCameraOff(serviceRef.current.toggleCamera());
  }

  async function finishCall(){
    if(hangingUpRef.current)return;
    hangingUpRef.current=true;
    await serviceRef.current?.hangUp().catch(()=>{});
    // Le message « Appel terminé » n'est écrit que si l'appel a réellement eu lieu
    if(startedAtRef.current||!WebViewComp){
      if(friend){
        // Un seul message « Appel terminé » par appel (identifiant fixe), même si les deux raccrochent
        await setDoc(doc(db,"friendChats",friend.cid,"messages","end_"+roomId),{
          type:"call_ended",callType:audioOnly?"audio":"video",
          senderUid:profile?.id,senderName:profile?.name,
          text:"Appel terminé",duration,sentAt:serverTimestamp(),
        }).catch(()=>{});
      }else{
        await addDoc(collection(db,"rooms",roomId,"messages"),{
          type:"call_ended",callType:audioOnly?"audio":"video",
          senderId:profile?.id,senderName:profile?.name,
          duration,sentAt:serverTimestamp(),
        }).catch(()=>{});
      }
    }
    navigation.goBack();
  }

  function hangUp(){
    Alert.alert("Raccrocher","Tu vas terminer l'appel.",[
      {text:"Annuler",style:"cancel"},
      {text:"Raccrocher",style:"destructive",onPress:finishCall},
    ]);
  }

  if(WebViewComp){
    const callUrl=buildCallUrl(roomId,profile?.name??"VimoX",audioOnly??false);
    return(
      <View style={styles.root}>
        {permsOk?(
          <WebViewComp
            source={{uri:callUrl}}
            style={{flex:1,backgroundColor:"#000"}}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grant"
            allowsFullscreenVideo
            setSupportMultipleWindows={false}
            originWhitelist={["https://*"]}
            onLoadEnd={()=>{
              setLoaded(true);
              if(!startedAtRef.current)startedAtRef.current=Date.now();
            }}
            onError={()=>setLoadError(true)}
            onHttpError={()=>setLoadError(true)}
            // La personne a quitté la salle depuis l'interface de l'appel : on ferme l'écran
            onNavigationStateChange={(nav:any)=>{
              if(startedAtRef.current&&nav?.url&&!String(nav.url).includes(callRoomName(roomId)))finishCall();
            }}
          />
        ):(
          <View style={styles.centerBox}>
            {permsAsked?(
              <>
                <Text style={styles.noticeTitle}>Autorise le micro{needsCam?" et la caméra":""}</Text>
                <Text style={styles.noticeTxt}>Sans cette autorisation, l'appel ne peut pas démarrer.</Text>
                <Pressable onPress={()=>Linking.openSettings()} style={styles.noticeBtn}>
                  <Text style={styles.noticeBtnTxt}>Ouvrir les réglages</Text>
                </Pressable>
              </>
            ):<ActivityIndicator color={colors.neonRed}/>}
          </View>
        )}
        {permsOk&&!loaded&&!loadError&&(
          <View style={[styles.centerBox,StyleSheet.absoluteFill,{backgroundColor:"#09090C"}]} pointerEvents="none">
            <ActivityIndicator color={colors.neonRed} size="large"/>
            <Text style={styles.noticeTxt}>Connexion à l'appel…</Text>
          </View>
        )}
        {loadError&&(
          <View style={[styles.centerBox,StyleSheet.absoluteFill,{backgroundColor:"#09090C"}]}>
            <Text style={styles.noticeTitle}>Appel impossible</Text>
            <Text style={styles.noticeTxt}>Vérifie ta connexion internet puis réessaie.</Text>
          </View>
        )}
        <View style={styles.callPill} pointerEvents="none">
          <Text style={styles.callPillName} numberOfLines={1}>{partnerProfile?.name??"Appel"}</Text>
          {loaded&&<Text style={styles.callPillTime}>{formatDuration(duration)}</Text>}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Raccrocher" onPress={hangUp} style={styles.callHangup} hitSlop={8}>
          <Text style={styles.callHangupIcon}>📵</Text>
        </Pressable>
      </View>
    );
  }

  return(
    <View style={styles.root}>
      <View style={styles.legacyBanner}>
        <Text style={styles.legacyBannerTxt}>
          Appels non activés : installe le module avec « npx expo install react-native-webview ».
        </Text>
      </View>
      <View style={styles.videoArea}>
        <View style={styles.remoteVideo}>
          <View style={styles.callTypeBadge}>
            <Text style={styles.callTypeText}>
              {isAudioOnly?"📞  Appel audio":"📹  Appel vidéo"}
            </Text>
          </View>
          {partnerProfile?.profilePhotoURL?(
            <Image source={{uri:partnerProfile.profilePhotoURL}} style={styles.partnerAvatar}/>
          ):(
            <View style={styles.partnerAvatarPlaceholder}>
              <Text style={styles.partnerInitial}>
                {partnerProfile?.name?.[0]?.toUpperCase()??"?"}
              </Text>
            </View>
          )}
          <Text style={styles.partnerName}>{partnerProfile?.name??"Partenaire"}</Text>
          <Text style={styles.partnerInfo}>
            {partnerProfile?[partnerAge!=null?`${partnerAge} ans`:"",partnerProfile.country].filter(Boolean).join(" · "):""}
          </Text>
          <Text style={styles.duration}>{formatDuration(duration)}</Text>
        </View>
        {!isAudioOnly&&(
          <View style={styles.localVideo}>
            <Text style={styles.localIcon}>{isCameraOff?"⊘":"◉"}</Text>
          </View>
        )}
      </View>

      {!isAudioOnly&&(
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.effectsBar} contentContainerStyle={styles.effectsContent}>
          {effects.map(e=>(
            <Pressable key={e} onPress={()=>setEffect(e)}
              style={[styles.effectChip,effect===e&&styles.effectChipActive]}>
              <Text style={[styles.effectText,effect===e&&styles.effectTextActive]}>{e}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <Pressable onPress={toggleMute}
            style={[styles.ctrlBtn,isMuted&&styles.ctrlBtnActive]}>
            <Text style={styles.ctrlIcon}>{isMuted?"🔇":"🎤"}</Text>
            <Text style={styles.ctrlLabel}>{isMuted?"Muet":"Micro"}</Text>
          </Pressable>
          <Pressable onPress={toggleCamera}
            style={[styles.ctrlBtn,isCameraOff&&styles.ctrlBtnActive,isAudioOnly&&styles.ctrlBtnDisabled]}>
            <Text style={styles.ctrlIcon}>{isCameraOff?"📷":"📸"}</Text>
            <Text style={styles.ctrlLabel}>{isCameraOff?"Cam OFF":"Caméra"}</Text>
          </Pressable>
          <Pressable onPress={()=>navigation.goBack()} style={styles.ctrlBtn}>
            <Text style={styles.ctrlIcon}>💬</Text>
            <Text style={styles.ctrlLabel}>Texte</Text>
          </Pressable>
        </View>
        <Pressable onPress={hangUp} style={styles.hangupBtn}>
          <Text style={styles.hangupIcon}>📵</Text>
          <Text style={styles.hangupText}>Raccrocher</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:"#09090C"},
  centerBox:{flex:1,alignItems:"center",justifyContent:"center",gap:12,padding:30},
  noticeTitle:{color:colors.text,fontSize:18,fontWeight:"800",textAlign:"center"},
  noticeTxt:{color:colors.muted,fontSize:14,textAlign:"center"},
  noticeBtn:{backgroundColor:colors.neonRed,borderRadius:14,paddingHorizontal:22,paddingVertical:12,marginTop:6},
  noticeBtnTxt:{color:"#fff",fontWeight:"800"},
  callPill:{position:"absolute",top:54,left:16,maxWidth:"60%",flexDirection:"row",alignItems:"center",gap:10,
    paddingHorizontal:14,paddingVertical:8,borderRadius:20,backgroundColor:"rgba(0,0,0,0.55)"},
  callPillName:{color:colors.text,fontSize:14,fontWeight:"800",flexShrink:1},
  callPillTime:{color:colors.muted,fontSize:13,fontWeight:"700"},
  callHangup:{position:"absolute",top:50,right:16,width:46,height:46,borderRadius:23,
    backgroundColor:colors.neonRed,alignItems:"center",justifyContent:"center"},
  callHangupIcon:{fontSize:22},
  legacyBanner:{backgroundColor:"#3a2a12",paddingTop:50,paddingBottom:8,paddingHorizontal:16},
  legacyBannerTxt:{color:"#e8d3a1",fontSize:12,fontWeight:"700",textAlign:"center"},
  videoArea:{flex:1,position:"relative"},
  remoteVideo:{flex:1,backgroundColor:"#111",alignItems:"center",justifyContent:"center",gap:12},
  callTypeBadge:{position:"absolute",top:54,left:16,paddingHorizontal:12,paddingVertical:6,
    borderRadius:20,backgroundColor:"rgba(0,0,0,0.5)",borderWidth:1,borderColor:"rgba(255,46,77,0.4)"},
  callTypeText:{color:colors.text,fontSize:13,fontWeight:"700"},
  partnerAvatar:{width:120,height:120,borderRadius:60,borderWidth:3,borderColor:colors.neonRed},
  partnerAvatarPlaceholder:{width:120,height:120,borderRadius:60,
    backgroundColor:"rgba(255,46,77,0.15)",alignItems:"center",justifyContent:"center",
    borderWidth:3,borderColor:colors.neonRed},
  partnerInitial:{color:colors.neonRed,fontSize:50,fontWeight:"900"},
  partnerName:{color:colors.text,fontSize:22,fontWeight:"900"},
  partnerInfo:{color:colors.muted,fontSize:14},
  duration:{color:colors.text,fontSize:22,fontWeight:"900",marginTop:8},
  localVideo:{position:"absolute",top:54,right:16,width:110,height:160,borderRadius:12,
    backgroundColor:"#222",alignItems:"center",justifyContent:"center",
    borderWidth:2,borderColor:colors.neonRed},
  localIcon:{fontSize:36},
  effectsBar:{maxHeight:50,backgroundColor:"#111"},
  effectsContent:{flexDirection:"row",gap:8,paddingHorizontal:12,paddingVertical:8},
  effectChip:{paddingHorizontal:14,paddingVertical:6,borderRadius:20,
    backgroundColor:"#1A1A1A",borderWidth:1,borderColor:"#333"},
  effectChipActive:{borderColor:colors.neonRed,backgroundColor:"rgba(255,46,77,0.15)"},
  effectText:{color:"rgba(255,255,255,0.5)",fontWeight:"600",fontSize:13},
  effectTextActive:{color:colors.neonRed},
  controls:{backgroundColor:"#111",paddingTop:16,paddingBottom:34,paddingHorizontal:20,
    gap:16,borderTopWidth:1,borderTopColor:"#222"},
  controlsRow:{flexDirection:"row",justifyContent:"space-around"},
  ctrlBtn:{alignItems:"center",gap:6,padding:12,borderRadius:12,
    backgroundColor:"#1A1A1A",minWidth:70},
  ctrlBtnActive:{backgroundColor:"rgba(255,46,77,0.15)",borderWidth:1,borderColor:colors.neonRed},
  ctrlBtnDisabled:{opacity:0.3},
  ctrlIcon:{fontSize:24},
  ctrlLabel:{color:"rgba(255,255,255,0.6)",fontSize:11,fontWeight:"600"},
  hangupBtn:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:10,
    backgroundColor:colors.neonRed,borderRadius:12,padding:14},
  hangupIcon:{fontSize:22},
  hangupText:{color:colors.text,fontWeight:"800",fontSize:16,letterSpacing:1},
});