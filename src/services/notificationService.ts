import{Platform}from"react-native";
import{doc,setDoc,getDoc}from"firebase/firestore";
import{db}from"../config/firebase";

// ✅ Import conditionnel — évite le crash dans Expo Go
let Notifications:any=null;
let Device:any=null;

try{
  Notifications=require("expo-notifications");
  Device=require("expo-device");

  Notifications.setNotificationHandler({
    handleNotification:async()=>({
      shouldShowAlert:true,
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
        lightColor:"#E8000A",
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
):Promise<void>{
  try{
    await fetch("https://exp.host/--/api/v2/push/send",{
      method:"POST",
      headers:{Accept:"application/json","Content-Type":"application/json"},
      body:JSON.stringify({
        to:toToken,title,body,data:data??{},
        sound:"default",badge:1,priority:"high",channelId:"default",
      }),
    });
  }catch(e){
    console.warn("sendPushNotification:",e);
  }
}

async function getUserToken(userId:string):Promise<string|null>{
  try{
    const snap=await getDoc(doc(db,"users",userId));
    return snap.data()?.pushToken??null;
  }catch{return null;}
}

export async function notifyNewMessage(
  recipientId:string,senderName:string,messageText:string,
):Promise<void>{
  const token=await getUserToken(recipientId);
  if(!token)return;
  await sendPushNotification(
    token,`💬 ${senderName}`,
    messageText.length>60?messageText.substring(0,60)+"...":messageText||"📷 Photo",
    {type:"message"},
  );
}

export async function notifyNewMatch(
  recipientId:string,partnerName?:string,
):Promise<void>{
  const token=await getUserToken(recipientId);
  if(!token)return;
  await sendPushNotification(
    token,"🔥 Nouveau match !",
    partnerName?`${partnerName} veut chatter avec toi`:"Quelqu'un veut chatter avec toi",
    {type:"match"},
  );
}

export async function notifyFriendRequest(
  recipientId:string,senderName:string,
):Promise<void>{
  const token=await getUserToken(recipientId);
  if(!token)return;
  await sendPushNotification(
    token,"👥 Demande d'ami",
    `${senderName} veut t'ajouter en ami`,
    {type:"friendRequest"},
  );
}

export async function clearBadge():Promise<void>{
  try{
    if(Notifications)await Notifications.setBadgeCountAsync(0);
  }catch{}
}