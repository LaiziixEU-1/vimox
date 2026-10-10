import{useEffect,useRef,useState}from"react";
import{Alert,Image,Pressable,ScrollView,StyleSheet,Text,View}from"react-native";
import{NativeStackScreenProps}from"@react-navigation/native-stack";
import{addDoc,collection,doc,getDoc,onSnapshot,serverTimestamp}from"firebase/firestore";
import{RootStackParamList,VimoXUser}from"../models/types";
import{useAuth}from"../services/AuthContext";
import{VideoCallService}from"../services/videoService";
import{colors}from"../theme/colors";
import{db}from"../config/firebase";

type Props=NativeStackScreenProps<RootStackParamList,"VideoCall">;
type Effect="Normal"|"N&B"|"Flou"|"Saturation"|"Néon"|"Avatar Pro";
const effects:Effect[]=["Normal","N&B","Flou","Saturation","Néon","Avatar Pro"];

export function VideoCallScreen({route,navigation}:Props){
  const{profile}=useAuth();
  const{roomId,audioOnly}=route.params;
  const serviceRef=useRef<VideoCallService|null>(null);
  const[isMuted,setIsMuted]=useState(false);
  const[isCameraOff,setIsCameraOff]=useState(audioOnly??false);
  const[isAudioOnly]=useState(audioOnly??false);
  const[effect,setEffect]=useState<Effect>("Normal");
  const[duration,setDuration]=useState(0);
  const[partnerProfile,setPartnerProfile]=useState<VimoXUser|null>(null);
  const callNotifSentRef=useRef(false);
  const hangingUpRef=useRef(false);

  useEffect(()=>{
    if(!profile)return;
    const service=new VideoCallService(roomId,profile.id);
    serviceRef.current=service;
    if(audioOnly)service.switchToAudioOnly();

    getDoc(doc(db,"rooms",roomId)).then(async snap=>{
      const participants=(snap.data()?.participants as string[])??[];
      const partnerId=participants.find(p=>p!==profile.id);
      if(partnerId){
        const userSnap=await getDoc(doc(db,"users",partnerId));
        if(userSnap.exists()){
          setPartnerProfile({id:userSnap.id,...userSnap.data()}as VimoXUser);
        }
      }
      if(!callNotifSentRef.current){
        callNotifSentRef.current=true;
        await addDoc(collection(db,"rooms",roomId,"messages"),{
          type:"call",callType:audioOnly?"audio":"video",
          callRoomId:roomId,senderId:profile.id,
          senderName:profile.name,isActive:true,
          sentAt:serverTimestamp(),
        }).catch(()=>{});
      }
    });

    return()=>{
      service.hangUp().catch(()=>{});
    };
  },[profile,roomId]);

  // ✅ Détecter quand l'autre raccroche
  useEffect(()=>{
    if(!profile)return;
    const unsub=onSnapshot(doc(db,"rooms",roomId),(snap)=>{
      if(!snap.exists())return;
      const data=snap.data();
      if(data?.isActive===false&&!hangingUpRef.current){
        Alert.alert("Appel terminé","L'autre personne a raccroché.",[
          {text:"OK",onPress:()=>navigation.goBack()},
        ]);
      }
    });
    return()=>unsub();
  },[profile,roomId]);

  useEffect(()=>{
    const timer=setInterval(()=>setDuration(d=>d+1),1000);
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

  async function hangUp(){
    Alert.alert("Raccrocher","Tu vas terminer l'appel.",[
      {text:"Annuler",style:"cancel"},
      {
        text:"Raccrocher",style:"destructive",
        onPress:async()=>{
          hangingUpRef.current=true;
          await serviceRef.current?.hangUp().catch(()=>{});
          await addDoc(collection(db,"rooms",roomId,"messages"),{
            type:"call_ended",callType:audioOnly?"audio":"video",
            senderId:profile?.id,senderName:profile?.name,
            duration,sentAt:serverTimestamp(),
          }).catch(()=>{});
          navigation.goBack();
        },
      },
    ]);
  }

  return(
    <View style={styles.root}>
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
            {partnerProfile?`${partnerProfile.age} ans · ${partnerProfile.country}`:""}
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
  root:{flex:1,backgroundColor:"#0A0A0A"},
  videoArea:{flex:1,position:"relative"},
  remoteVideo:{flex:1,backgroundColor:"#111",alignItems:"center",justifyContent:"center",gap:12},
  callTypeBadge:{position:"absolute",top:54,left:16,paddingHorizontal:12,paddingVertical:6,
    borderRadius:20,backgroundColor:"rgba(0,0,0,0.5)",borderWidth:1,borderColor:"rgba(232,0,10,0.4)"},
  callTypeText:{color:colors.text,fontSize:13,fontWeight:"700"},
  partnerAvatar:{width:120,height:120,borderRadius:60,borderWidth:3,borderColor:colors.neonRed},
  partnerAvatarPlaceholder:{width:120,height:120,borderRadius:60,
    backgroundColor:"rgba(232,0,10,0.15)",alignItems:"center",justifyContent:"center",
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
  effectChipActive:{borderColor:colors.neonRed,backgroundColor:"rgba(232,0,10,0.15)"},
  effectText:{color:"rgba(255,255,255,0.5)",fontWeight:"600",fontSize:13},
  effectTextActive:{color:colors.neonRed},
  controls:{backgroundColor:"#111",paddingTop:16,paddingBottom:34,paddingHorizontal:20,
    gap:16,borderTopWidth:1,borderTopColor:"#222"},
  controlsRow:{flexDirection:"row",justifyContent:"space-around"},
  ctrlBtn:{alignItems:"center",gap:6,padding:12,borderRadius:12,
    backgroundColor:"#1A1A1A",minWidth:70},
  ctrlBtnActive:{backgroundColor:"rgba(232,0,10,0.15)",borderWidth:1,borderColor:colors.neonRed},
  ctrlBtnDisabled:{opacity:0.3},
  ctrlIcon:{fontSize:24},
  ctrlLabel:{color:"rgba(255,255,255,0.6)",fontSize:11,fontWeight:"600"},
  hangupBtn:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:10,
    backgroundColor:colors.neonRed,borderRadius:12,padding:14},
  hangupIcon:{fontSize:22},
  hangupText:{color:colors.text,fontWeight:"800",fontSize:16,letterSpacing:1},
});