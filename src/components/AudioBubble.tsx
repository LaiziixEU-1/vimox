import{Pressable,StyleSheet,Text,View}from"react-native";
import{useAudioPlayer}from"../hooks/useAudioPlayer";

interface Props{uri:string;duration:number;mine:boolean;}

export function AudioBubble({uri,duration,mine}:Props){
  const{state,progress,currentTime,toggle}=useAudioPlayer(uri);
  const fmt=(s:number)=>`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  const total=duration;
  const filled=Math.round(progress*12);

  return(
    <Pressable onPress={toggle} style={[s.wrap,mine?s.mine:s.other]}>
      <View style={s.playBtn}>
        <Text style={s.playIcon}>
          {state==="loading"?"⏳":state==="playing"?"⏸":"▶"}
        </Text>
      </View>
      <View style={s.barWrap}>
        <View style={s.bar}>
          {Array.from({length:12}).map((_,i)=>(
            <View key={i} style={[s.barSeg,
              i<filled?s.barFilled:s.barEmpty,
              {height:6+Math.sin(i*0.8)*6}]}/>
          ))}
        </View>
        <Text style={s.time}>{state==="playing"?fmt(currentTime):fmt(total)}</Text>
      </View>
    </Pressable>
  );
}

const s=StyleSheet.create({
  wrap:{flexDirection:"row",alignItems:"center",gap:10,
    borderRadius:16,paddingHorizontal:12,paddingVertical:10,maxWidth:220},
  mine:{backgroundColor:"#E8000A"},
  other:{backgroundColor:"rgba(255,255,255,0.08)",
    borderWidth:1,borderColor:"rgba(255,255,255,0.10)"},
  playBtn:{width:34,height:34,borderRadius:17,
    backgroundColor:"rgba(255,255,255,0.20)",
    alignItems:"center",justifyContent:"center"},
  playIcon:{fontSize:14,color:"#fff"},
  barWrap:{flex:1,gap:4},
  bar:{flexDirection:"row",alignItems:"center",gap:2,height:24},
  barSeg:{width:5,borderRadius:3},
  barFilled:{backgroundColor:"rgba(255,255,255,0.9)"},
  barEmpty:{backgroundColor:"rgba(255,255,255,0.3)"},
  time:{color:"rgba(255,255,255,0.7)",fontSize:10},
});