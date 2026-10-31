/*VIMOX-V29*/
import{Platform}from"react-native";
import{doc,setDoc,getDoc,updateDoc}from"firebase/firestore";
import{db}from"../config/firebase";
import{isMutedBy}from"./muteService";

// ✅ Import conditionnel — évite le crash dans Expo Go
let Notifications:any=null;
let Device:any=null;

try{
  Notifications=require("expo-notifications");
  Device=require("expo-device");

  Notifications.setNotificationHandler({
    handleNotification:async()=>({
      shouldShowAlert:true,
      shouldShowBanner:true,
      shouldShowList:true,
      shouldPlaySound:true,
      shouldSetBadge:false,
    }),
  });
}catch(e){
  console.warn("expo-notifications non disponible dans Expo Go");
}

export async function registerPushToken(userId:string):Promise<void>{
  try{
    if(!Notifications||!Device)return;
    if(!Device.isDevice)return;

    const{status:existing}=await Notifications.getPermissionsAsync();
    let finalStatus=existing;

    if(existing!=="granted"){
      const{status}=await Notifications.requestPermissionsAsync();
      finalStatus=status;
    }
    if(finalStatus!=="granted")return;

    if(Platform.OS==="android"){
      await Notifications.setNotificationChannelAsync("default",{
        name:"VimoX",
        importance:Notifications.AndroidImportance?.MAX,
        vibrationPattern:[0,250,250,250],
        lightColor:"#FF2E4D",
        sound:"default",
      });
    }

    const token=(await Notifications.getExpoPushTokenAsync()).data;
    await setDoc(doc(db,"users",userId),{pushToken:token},{merge:true});
  }catch(e){
    console.warn("registerPushToken:",e);
  }
}

async function sendPushNotification(
  toToken:string,title:string,body:string,
  data?:Record<string,any>,
  sound:boolean=true,
):Promise<void>{
  // Version web : le navigateur bloque l'appel direct au service d'Expo (sécurité « CORS »)
  if(Platform.OS==="web")return;
  try{
    await fetch("https://exp.host/--/api/v2/push/send",{
      method:"POST",
      headers:{Accept:"application/json","Content-Type":"application/json"},
      body:JSON.stringify({
        to:toToken,title,body,data:data??{},
        sound:sound?"default":null,badge:1,priority:"high",channelId:"default",
      }),
    });
  }catch(e){
    console.warn("sendPushNotification:",e);
  }
}

// Jeton + réglages de notification du destinataire (Paramètres > Notifications)
async function getUserPush(userId:string):Promise<{token:string;push:boolean;preview:boolean;sounds:boolean}|null>{
  try{
    const snap=await getDoc(doc(db,"users",userId));
    const d=snap.data();
    if(!d?.pushToken)return null;
    return{
      token:d.pushToken,
      push:d.notifPush!==false,
      preview:d.notifPreview!==false,
      sounds:d.notifSounds!==false,
    };
  }catch{return null;}
}

export async function notifyNewMessage(
  recipientId:string,senderName:string,messageText:string,
  extra?:Record<string,any>, // ex. {roomId} : toucher la notification ouvre cette conversation
):Promise<void>{
  const info=await getUserPush(recipientId);
  if(!info||!info.push)return;
  const preview=messageText.length>60?messageText.substring(0,60)+"...":messageText||"📷 Photo";
  await sendPushNotification(
    info.token,`💬 ${senderName}`,
    info.preview?preview:"Nouveau message",
    {type:"message",...extra},info.sounds,
  );
}

// Message d'un AMI (conversation privée) : ouvre la conversation avec lui
export async function notifyFriendMessage(
  recipientId:string,senderId:string,senderName:string,messageText:string,
):Promise<void>{
  const info=await getUserPush(recipientId);
  if(!info||!info.push)return;
  if(await isMutedBy(recipientId,senderId,"messages"))return;
  const preview=messageText.length>60?messageText.substring(0,60)+"...":messageText||"📷 Photo";
  await sendPushNotification(
    info.token,`💬 ${senderName}`,
    info.preview?preview:"Nouveau message",
    {type:"friendMessage",friendId:senderId,friendName:senderName},info.sounds,
  );
}

// Appel d'un ami : toucher la notification ouvre la conversation, où le bouton « Rejoindre » attend
export async function notifyFriendCall(
  recipientId:string,senderId:string,senderName:string,audioOnly:boolean,
):Promise<void>{
  const info=await getUserPush(recipientId);
  if(!info||!info.push)return;
  if(await isMutedBy(recipientId,senderId,"calls"))return;
  await sendPushNotification(
    info.token,`📞 ${senderName}`,
    audioOnly?"T'appelle (appel vocal)":"T'appelle (appel vidéo)",
    {type:"friendMessage",friendId:senderId,friendName:senderName},info.sounds,
  );
}

// Nouveau Snap : ouvre la conversation avec l'expéditeur
export async function notifyNewSnap(
  recipientId:string,senderId:string,
):Promise<void>{
  const info=await getUserPush(recipientId);
  if(!info||!info.push)return;
  if(await isMutedBy(recipientId,senderId,"messages"))return;
  let senderName="Un ami";
  try{
    const snap=await getDoc(doc(db,"users",senderId));
    senderName=snap.data()?.name??senderName;
  }catch{}
  await sendPushNotification(
    info.token,"📸 Nouveau Vim",
    info.preview?`${senderName} t'a envoyé un Vim`:"Tu as reçu un Vim",
    {type:"snap",friendId:senderId,friendName:senderName},info.sounds,
  );
}

export async function notifyNewMatch(
  recipientId:string,partnerName?:string,
):Promise<void>{
  const info=await getUserPush(recipientId);
  if(!info||!info.push)return;
  await sendPushNotification(
    info.token,"🔥 Nouveau match !",
    partnerName?`${partnerName} veut chatter avec toi`:"Quelqu'un veut chatter avec toi",
    {type:"match"},info.sounds,
  );
}

export async function notifyFriendRequest(
  recipientId:string,senderName:string,
):Promise<void>{
  const info=await getUserPush(recipientId);
  if(!info||!info.push)return;
  await sendPushNotification(
    info.token,"👥 Demande d'ami",
    `${senderName} veut t'ajouter en ami`,
    {type:"friendRequest"},info.sounds,
  );
}

// ⏳ Rappel de flamme (notification locale, programmée sur le téléphone, rien n'est envoyé)
// Une seule notification à la fois : la nouvelle remplace l'ancienne.
let streakReminderId:string|null=null;
export async function scheduleStreakReminder(atRisk:{name:string;count:number}[]):Promise<void>{
  try{
    if(!Notifications)return;
    if(streakReminderId){
      await Notifications.cancelScheduledNotificationAsync(streakReminderId).catch(()=>{});
      streakReminderId=null;
    }
    if(atRisk.length===0)return;
    const when=new Date();
    when.setHours(20,0,0,0);
    if(when.getTime()<=Date.now())return; // après 20 h : l'icône ⏳ est déjà visible dans l'app
    const first=atRisk[0];
    const title="⏳ Ta flamme va s'éteindre !";
    const body=atRisk.length===1
      ?`Ta flamme 🔥${first.count} avec ${first.name} s'éteint à minuit. Envoyez-vous un Vim !`
      :`${atRisk.length} flammes s'éteignent à minuit, dont 🔥${first.count} avec ${first.name}. Envoie des Vims !`;
    streakReminderId=await Notifications.scheduleNotificationAsync({
      content:{title,body,sound:"default",data:{type:"streak"}},
      trigger:{type:Notifications.SchedulableTriggerInputTypes?.DATE??"date",date:when},
    });
  }catch{}
}

// Chiffre sur l'icône de l'app (nombre de choses non lues)
export async function setAppBadge(n:number):Promise<void>{
  try{
    if(Notifications)await Notifications.setBadgeCountAsync(Math.max(0,Math.floor(n||0)));
  }catch{}
}

export async function clearBadge():Promise<void>{
  try{
    if(Notifications)await Notifications.setBadgeCountAsync(0);
  }catch{}
}

// À la déconnexion : ce téléphone ne doit plus recevoir les notifications de ce compte
export async function unregisterPushToken(userId:string):Promise<void>{
  try{await updateDoc(doc(db,"users",userId),{pushToken:null});}catch{}
}

// ─────────────────────────────────────────────────────────────
// Toucher une notification ouvre l'écran concerné
// ─────────────────────────────────────────────────────────────
export type NotificationTarget={name:string;params?:Record<string,any>};

const SAFE_ID=/^[A-Za-z0-9_-]{6,128}$/;

export function routeFromNotification(data:any):NotificationTarget|null{
  if(!data||typeof data!=="object")return null;
  switch(data.type){
    case "message":
      return SAFE_ID.test(String(data.roomId??""))?{name:"ChatRoom",params:{roomId:String(data.roomId)}}:null;
    case "friendMessage":
    case "snap":
      return SAFE_ID.test(String(data.friendId??""))
        ?{name:"FriendChat",params:{friendId:String(data.friendId),friendName:String(data.friendName??"").slice(0,60)}}
        :null;
    case "group":
      return SAFE_ID.test(String(data.groupId??""))?{name:"GroupChat",params:{groupId:String(data.groupId),name:String(data.name??"").slice(0,40)}}:null;
    case "friendRequest":
      return{name:"Friends"};
    default:
      return null;
  }
}

// Appelle handler avec les données de la notification touchée (y compris au démarrage à froid)
export function subscribeNotificationTaps(handler:(data:any)=>void):()=>void{
  if(!Notifications)return()=>{};
  try{
    Notifications.getLastNotificationResponseAsync?.()
      .then((resp:any)=>{if(resp)handler(resp.notification?.request?.content?.data);})
      .catch(()=>{});
    const sub=Notifications.addNotificationResponseReceivedListener((resp:any)=>{
      handler(resp?.notification?.request?.content?.data);
    });
    return()=>sub?.remove?.();
  }catch{return()=>{};}
}
