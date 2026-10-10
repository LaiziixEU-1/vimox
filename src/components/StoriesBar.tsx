import{useEffect,useState,useCallback,useRef}from"react";
import{
  View,Text,StyleSheet,Pressable,ScrollView,Image,ActivityIndicator,
}from"react-native";
import{useFocusEffect}from"@react-navigation/native";
import{useAuth}from"../services/AuthContext";
import{subscribeFriends}from"../services/friendService";
import{getFriendsStories,UserStories}from"../services/storyService";

interface Props{
  onPressStory:(stories:UserStories[],startIndex:number)=>void;
  onPressAdd:()=>void;
}

export function StoriesBar({onPressStory,onPressAdd}:Props){
  const{profile}=useAuth();
  const[userStories,setUserStories]=useState<UserStories[]>([]);
  const[loading,setLoading]=useState(true);
  // ✅ Garde les friendIds en mémoire pour useFocusEffect
  const friendIdsRef=useRef<string[]>([]);

  async function loadStories(friendIds:string[]){
    if(!profile)return;
    const stories=await getFriendsStories(profile.id,friendIds).catch(()=>[]);
    setUserStories(stories);
    setLoading(false);
  }

  // ✅ Charge les amis et garde les IDs dans le ref
  useEffect(()=>{
    if(!profile)return;
    return subscribeFriends(profile.id,async(friends)=>{
      const friendIds=friends.map((f:any)=>f.id);
      friendIdsRef.current=friendIds; // ✅ Sauvegarde les IDs
      await loadStories(friendIds);
    });
  },[profile]);

  // ✅ Fix — utilise friendIdsRef.current au lieu de []
  useFocusEffect(
    useCallback(()=>{
      if(!profile)return;
      loadStories(friendIdsRef.current); // ✅ Plus de tableau vide
    },[profile]),
  );

  const myStories=userStories.find(u=>u.userId===profile?.id);

  return(
    <View style={s.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scroll}>

        {/* Mon story / Ajouter */}
        <Pressable
          onPress={myStories?()=>onPressStory(userStories,0):onPressAdd}
          style={s.item}>
          <View style={[s.ring,myStories?s.ringActive:s.ringAdd]}>
            {profile?.profilePhotoURL?(
              <Image source={{uri:profile.profilePhotoURL}} style={s.avatar}/>
            ):(
              <View style={[s.avatarFallback,{backgroundColor:"#E8000A22"}]}>
                <Text style={s.avatarInitial}>{profile?.name?.[0]?.toUpperCase()??"?"}</Text>
              </View>
            )}
            {!myStories&&(
              <View style={s.addBadge}>
                <Text style={s.addBadgeTxt}>+</Text>
              </View>
            )}
          </View>
          <Text style={s.name} numberOfLines={1}>{myStories?"Ma story":"Ajouter"}</Text>
        </Pressable>

        {/* Stories amis */}
        {userStories
          .filter(u=>u.userId!==profile?.id)
          .map((u,i)=>(
            <Pressable key={u.userId}
              onPress={()=>onPressStory(userStories,i+(myStories?1:0))}
              style={s.item}>
              <View style={[s.ring,u.hasUnviewed?s.ringActive:s.ringViewed]}>
                {u.userPhoto?(
                  <Image source={{uri:u.userPhoto}} style={s.avatar}/>
                ):(
                  <View style={[s.avatarFallback,{backgroundColor:"#333333"}]}>
                    <Text style={s.avatarInitial}>{u.userName?.[0]?.toUpperCase()??"?"}</Text>
                  </View>
                )}
              </View>
              <Text style={s.name} numberOfLines={1}>{u.userName}</Text>
            </Pressable>
          ))}

        {loading&&<ActivityIndicator color="#E8000A" style={{marginLeft:16}}/>}
      </ScrollView>
    </View>
  );
}

const s=StyleSheet.create({
  wrap:{backgroundColor:"#0a0a0a",borderBottomWidth:1,borderBottomColor:"#1a1a1a"},
  scroll:{paddingHorizontal:16,paddingVertical:12,gap:14},
  item:{alignItems:"center",gap:6,width:64},
  ring:{width:62,height:62,borderRadius:20,borderWidth:2.5,padding:2,
    alignItems:"center",justifyContent:"center"},
  ringActive:{borderColor:"#E8000A"},
  ringViewed:{borderColor:"#333"},
  ringAdd:{borderColor:"#333",borderStyle:"dashed"},
  avatar:{width:52,height:52,borderRadius:16},
  avatarFallback:{width:52,height:52,borderRadius:16,alignItems:"center",justifyContent:"center"},
  avatarInitial:{color:"#E8000A",fontSize:20,fontWeight:"900"},
  addBadge:{position:"absolute",bottom:-2,right:-2,width:20,height:20,borderRadius:6,
    backgroundColor:"#E8000A",alignItems:"center",justifyContent:"center",
    borderWidth:2,borderColor:"#0a0a0a"},
  addBadgeTxt:{color:"#fff",fontSize:12,fontWeight:"900"},
  name:{color:"#555",fontSize:10,fontWeight:"600",textAlign:"center",width:64},
});