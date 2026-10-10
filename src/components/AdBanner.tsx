import{StyleSheet,Text,View,Pressable}from"react-native";
import{useAuth}from"../services/AuthContext";
import{colors}from"../theme/colors";

const ADS=[
  {emoji:"🎮",title:"Clash of Clans",sub:"Joue gratuitement maintenant !",color:"#1a472a"},
  {emoji:"🎵",title:"Spotify Premium",sub:"3 mois gratuits pour toi",color:"#1DB954"},
  {emoji:"👟",title:"Nike Air Max",sub:"Jusqu'à -50% ce weekend",color:"#111"},
  {emoji:"🍕",title:"Uber Eats",sub:"Livraison offerte sur ta commande",color:"#06C167"},
];

export function AdBanner(){
  const{profile}=useAuth();
  if(profile?.isPremium)return null; // ✅ Caché pour premium

  const ad=ADS[Math.floor(Date.now()/1000/60)%ADS.length];

  return(
    <Pressable style={[styles.banner,{borderLeftColor:ad.color}]}>
      <Text style={styles.adLabel}>PUB</Text>
      <Text style={styles.emoji}>{ad.emoji}</Text>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{ad.title}</Text>
        <Text style={styles.sub}>{ad.sub}</Text>
      </View>
      <Text style={styles.cta}>Voir →</Text>
    </Pressable>
  );
}

const styles=StyleSheet.create({
  banner:{
    flexDirection:"row",alignItems:"center",gap:10,
    backgroundColor:"rgba(255,255,255,0.04)",
    borderWidth:1,borderColor:"rgba(255,255,255,0.08)",
    borderLeftWidth:3,borderRadius:12,
    paddingHorizontal:14,paddingVertical:10,marginHorizontal:16,marginVertical:6,
  },
  adLabel:{fontSize:8,color:"rgba(255,255,255,0.25)",fontWeight:"700",
    letterSpacing:1,position:"absolute",top:4,right:8},
  emoji:{fontSize:24},
  textWrap:{flex:1},
  title:{color:colors.text,fontSize:13,fontWeight:"700"},
  sub:{color:colors.muted,fontSize:11},
  cta:{color:"#E8000A",fontSize:11,fontWeight:"700"},
});