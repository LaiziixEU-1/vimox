import{useRef,useState}from"react";
import{Animated,Pressable,StyleSheet,Text,View,Alert}from"react-native";
import{useVoiceRecorder}from"../hooks/useVoiceRecorder";

interface Props{
  onRecorded:(uri:string,duration:number)=>void;
}

export function VoiceMessageButton({onRecorded}:Props){
  const{state,duration,startRecording,stopRecording,cancelRecording}=useVoiceRecorder();
  const scale=useRef(new Animated.Value(1)).current;
  const pulse=useRef(new Animated.Value(1)).current;

  function fmt(s:number){return`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}` ;}

  async function handlePress(){
    if(state==="idle"||state==="stopped"){
      const ok=await startRecording();
      if(ok){
        Animated.loop(Animated.sequence([
          Animated.timing(pulse,{toValue:1.2,duration:600,useNativeDriver:true}),
          Animated.timing(pulse,{toValue:1,duration:600,useNativeDriver:true}),
        ])).start();
      }
    }else if(state==="recording"){
      pulse.stopAnimation();
      pulse.setValue(1);
      const result=await stopRecording();
      if(result&&result.duration>=1){
        onRecorded(result.uri,result.duration);
      }else{
        Alert.alert("Trop court","Maintiens le bouton plus longtemps.");
      }
    }
  }

  async function handleLongCancel(){
    if(state==="recording"){
      await cancelRecording();
      pulse.stopAnimation();pulse.setValue(1);
    }
  }

  return(
    <View style={s.wrap}>
      {state==="recording"&&(
        <View style={s.recRow}>
          <View style={s.recDot}/>
          <Text style={s.recTime}>{fmt(duration)}</Text>
          <Pressable onPress={handleLongCancel} style={s.cancelBtn}>
            <Text style={s.cancelTxt}>✕</Text>
          </Pressable>
        </View>
      )}
      <Animated.View style={{transform:[{scale:state==="recording"?pulse:scale}]}}>
        <Pressable
          onPress={handlePress}
          style={[s.btn,state==="recording"&&s.btnActive]}
        >
          <Text style={s.icon}>{state==="recording"?"⏹":"🎤"}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const s=StyleSheet.create({
  wrap:{flexDirection:"row",alignItems:"center",gap:8},
  recRow:{flexDirection:"row",alignItems:"center",gap:6,
    backgroundColor:"rgba(232,0,10,0.12)",borderRadius:20,
    paddingHorizontal:10,paddingVertical:4},
  recDot:{width:7,height:7,borderRadius:4,backgroundColor:"#E8000A"},
  recTime:{color:"#E8000A",fontSize:12,fontWeight:"700"},
  cancelBtn:{padding:4},
  cancelTxt:{color:"rgba(255,255,255,0.4)",fontSize:13},
  btn:{width:44,height:44,borderRadius:22,
    backgroundColor:"rgba(255,255,255,0.06)",
    alignItems:"center",justifyContent:"center",
    borderWidth:1,borderColor:"rgba(255,255,255,0.10)"},
  btnActive:{backgroundColor:"rgba(232,0,10,0.20)",borderColor:"#E8000A"},
  icon:{fontSize:20},
});